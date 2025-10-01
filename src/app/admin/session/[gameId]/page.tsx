
"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { db, auth } from "@/lib/firebase";
import { doc, onSnapshot, updateDoc, getDoc } from "firebase/firestore";
import type { Game, GameTheme, SessionType, CustomPlayerField } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Plus, Upload, Users, User, Swords } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { extractQuestionsFromPdfAction } from "@/lib/actions";
import { useAuthState } from "react-firebase-hooks/auth";
import { v4 as uuidv4 } from 'uuid';


const themes: {value: GameTheme, label: string}[] = [
    { value: 'default', label: 'Default' },
    { value: 'team-alpha', label: 'Team Alpha' },
    { value: 'team-bravo', label: 'Team Bravo' },
];

const sessionSchema = z.object({
  title: z.string().min(1, "Title is required."),
  timer: z.coerce.number().min(30, "Timer must be at least 30 seconds."),
  sessionType: z.enum(['team', 'individual', 'matchmaking']),
  teams: z.array(z.object({
    name: z.string().min(1, "Team name is required."),
    capacity: z.coerce.number().min(1, "Capacity must be at least 1."),
    color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a valid hex color"),
    icon: z.string().url("Must be a valid URL.").or(z.literal('')),
  })).min(1, "At least one team is required."),
  requiredPlayerFields: z.array(z.object({
    id: z.string(),
    label: z.string().min(1, "Field label cannot be empty."),
    type: z.enum(['text', 'email', 'tel']),
  })),
  questions: z.array(z.object({
      question: z.string().min(1, "Question text is required."),
      options: z.array(z.string().min(1, "Option text is required.")).min(2, "At least two options are required.").max(4, "You can have a maximum of 4 options."),
      answer: z.string().min(1, "An answer is required."),
  })).refine(
      (questions) => questions.every(q => q.options.includes(q.answer)),
      {
        message: "The correct answer must be one of the options.",
        path: ["questions"], 
      }
  ),
  topic: z.string(),
  theme: z.enum(["default", "team-alpha", "team-bravo"]),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

function QuestionItem({ control, index, removeQuestion, getValues }: { control: Control<any>, index: number, removeQuestion: (index: number) => void, getValues: any }) {
    const { fields: optionFields, append: appendOption, remove: removeOption } = useFieldArray({
        control,
        name: `questions.${index}.options`
    });

    return (
        <div className="p-4 border rounded-lg space-y-4">
            <Button type="button" variant="destructive" onClick={() => removeQuestion(index)}>Delete Question</Button>
            <FormField control={control} name={`questions.${index}.question`} render={({ field }) => (
                <FormItem><FormLabel>Question</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
            )}/>
            
            <FormField
              control={control}
              name={`questions.${index}.answer`}
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel>Options &amp; Correct Answer</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                      {optionFields.map((optionItem, optionIndex) => (
                        <FormField
                          key={optionItem.id}
                          control={control}
                          name={`questions.${index}.options.${optionIndex}`}
                          render={({ field: optionField }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value={optionField.value} />
                              </FormControl>
                              <Input {...optionField} placeholder={`Option ${optionIndex + 1}`} className="flex-1" />
                               <Button type="button" variant="ghost" size="icon" onClick={() => removeOption(optionIndex)} disabled={optionFields.length <= 2}>
                                  <Trash2 className="h-4 w-4 text-muted-foreground"/>
                              </Button>
                            </FormItem>
                          )}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {optionFields.length < 4 && (
              <Button type="button" size="sm" variant="outline" onClick={() => appendOption('')}>Add Option</Button>
            )}
        </div>
    );
}

export default function SessionConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const gameId = params.gameId as string;
  const [user, authLoading] = useAuthState(auth);
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
        title: "Trivia Titans",
        timer: 300,
        sessionType: 'team',
        teams: [],
        requiredPlayerFields: [],
        questions: [],
        topic: "General Knowledge",
        theme: "default",
    }
  });

  const sessionType = form.watch('sessionType');
  
  const { fields: teamFields, append: appendTeam, remove: removeTeam } = useFieldArray({
    control: form.control,
    name: "teams",
  });

  const { fields: fieldFields, append: appendField, remove: removeField } = useFieldArray({
    control: form.control,
    name: "requiredPlayerFields",
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion, replace: replaceQuestions } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  useEffect(() => {
    if (!gameId || authLoading) return;
    
    if (!user) {
        router.replace('/admin/login');
        return;
    }

    const gameRef = doc(db, "games", gameId.toUpperCase());
    
    const unsubscribe = onSnapshot(gameRef, (docSnap) => {
      if (docSnap.exists()) {
        const gameData = docSnap.data() as Game;
        
        const isOwner = gameData.adminId === user.uid;
        if (isOwner) {
            setIsAuthorized(true);
            setGame(gameData);
            if (!form.formState.isDirty) {
              form.reset({
                title: gameData.title || "Trivia Titans",
                timer: gameData.timer,
                sessionType: gameData.sessionType || 'team',
                teams: gameData.teams.map(t => ({ name: t.name, capacity: t.capacity, color: t.color || '#ffffff', icon: t.icon || '' })),
                requiredPlayerFields: gameData.requiredPlayerFields || [],
                questions: gameData.questions.map(q => ({...q, options: q.options || []})),
                topic: gameData.topic,
                theme: gameData.theme || 'default',
              });
            }
        } else {
            setIsAuthorized(false);
        }
      } else {
        toast({ title: "Not Found", description: "This game session does not exist.", variant: "destructive" });
        router.push('/admin');
      }
      setLoading(false);
    });

    return () => unsubscribe();

  }, [gameId, user, authLoading, form, router, toast]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
        toast({ title: "Invalid File Type", description: "Please upload a PDF file.", variant: "destructive" });
        return;
    }

    setIsExtracting(true);
    try {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = async () => {
            const pdfDataUri = reader.result as string;
            const currentTopic = form.getValues('topic');

            const result = await extractQuestionsFromPdfAction({ pdfDataUri, topic: currentTopic });
            
            if (result.questions && result.questions.length > 0) {
                const existingQuestions = form.getValues('questions');
                replaceQuestions([...existingQuestions, ...result.questions]);
                toast({ title: "Success", description: `${result.questions.length} questions were extracted from the PDF.` });
            } else {
                 toast({ title: "No Questions Found", description: "The AI could not find any valid questions in the PDF.", variant: "destructive" });
            }
        };
        reader.onerror = (error) => {
            console.error('Error reading file:', error);
            toast({ title: "File Read Error", description: "There was a problem reading your file.", variant: "destructive" });
        }
    } catch(error) {
        console.error(error);
        toast({ title: "Extraction Failed", description: "The AI failed to extract questions. Please check the console for errors.", variant: "destructive" });
    } finally {
        setIsExtracting(false);
        if(fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    }
  };

  const onSubmit = async (data: SessionFormValues) => {
    if (!user) return;
    try {
        const gameRef = doc(db, "games", gameId);
        
        const gameDoc = await getDoc(gameRef);
        if (gameDoc.exists()) {
            const gameData = gameDoc.data();
            const isOwner = gameData.adminId === user.uid;
            if (!isOwner) {
                 toast({ title: "Authorization Error", description: "You are not authorized to edit this session.", variant: "destructive" });
                 router.push('/admin');
                 return;
            }
        }
        
        let teamsUpdate;

        if (data.sessionType === 'team' || data.sessionType === 'matchmaking') {
            teamsUpdate = data.teams.map(t => ({
                ...t,
                score: game?.teams.find(originalTeam => originalTeam.name === t.name)?.score || 0,
                players: game?.teams.find(originalTeam => originalTeam.name === t.name)?.players || []
            }));
        } else { // individual
            // For these modes, we create a "virtual" team to hold all players/state.
            teamsUpdate = [{
                name: "Participants",
                score: 0,
                players: game?.teams?.[0]?.players || [],
                capacity: 999,
                color: '#888888',
                icon: ''
            }];
        }


        await updateDoc(gameRef, {
          title: data.title,
          timer: data.timer,
          sessionType: data.sessionType,
          teams: teamsUpdate,
          requiredPlayerFields: data.requiredPlayerFields,
          questions: data.questions,
          topic: data.topic,
          theme: data.theme,
        });

        toast({
            title: "Session Updated",
            description: "The game session has been successfully updated.",
        });
        router.push("/admin");
    } catch(error) {
        console.error(error);
        toast({
            title: "Error",
            description: "Failed to update the session.",
            variant: "destructive",
        })
    }
  };

  if (loading || authLoading) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }

  if (!isAuthorized) {
    return (
        <div className="flex items-center justify-center h-screen">
            <Card className="max-w-md text-center">
                <CardHeader>
                    <CardTitle className="text-destructive">Access Denied</CardTitle>
                </CardHeader>
                <CardContent>
                    <p>You are not authorized to edit this session. Please contact the session owner.</p>
                    <Button onClick={() => router.push('/admin')} className="mt-4">Back to Dashboard</Button>
                </CardContent>
            </Card>
        </div>
    );
  }
  
  if (!game) {
    return (
      <div className="flex items-center justify-center h-screen">
        <h1>Game session not found.</h1>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Configure Session: {gameId}</CardTitle>
          <CardDescription>Edit the details for this trivia game session.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <Card>
                <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="title" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Game Title</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                             <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="timer" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Game Timer (seconds)</FormLabel>
                            <FormControl><Input type="number" {...field} /></FormControl>
                             <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="topic" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Topic (for AI Questions)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                             <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="theme" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Session Theme</FormLabel>
                             <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select a theme" />
                                </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    {themes.map(theme => (
                                        <SelectItem key={theme.value} value={theme.value}>{theme.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <FormDescription>Customize the look and feel of the game.</FormDescription>
                             <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
              </Card>
              
               <Card>
                <CardHeader><CardTitle>Session Type</CardTitle></CardHeader>
                <CardContent>
                     <FormField control={form.control} name="sessionType" render={({ field }) => (
                        <FormItem>
                             <FormControl>
                                <RadioGroup
                                    onValueChange={field.onChange}
                                    defaultValue={field.value}
                                    className="grid grid-cols-1 md:grid-cols-3 gap-4"
                                >
                                    <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="team" className="sr-only" />
                                        <Users className="mb-3 h-6 w-6" />
                                        Team Battle
                                    </Label>
                                     <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="individual" className="sr-only" />
                                        <User className="mb-3 h-6 w-6" />
                                        Individual Challenge
                                    </Label>
                                     <Label className="flex flex-col items-center justify-center rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary">
                                        <RadioGroupItem value="matchmaking" className="sr-only" />
                                        <Swords className="mb-3 h-6 w-6" />
                                        1v1 Matchmaking
                                    </Label>
                                </RadioGroup>
                             </FormControl>
                             <FormMessage />
                        </FormItem>
                    )} />
                </CardContent>
              </Card>

              {sessionType === 'team' ? (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Teams</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendTeam({ name: `Team ${teamFields.length + 1}`, capacity: 10, color: '#FFFFFF', icon: '' })}>
                                <Plus className="mr-2" /> Add Team
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {teamFields.map((field, index) => (
                            <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_1fr_auto] gap-4 items-end p-4 border rounded-lg">
                                <FormField control={form.control} name={`teams.${index}.name`} render={({ field }) => (
                                    <FormItem><FormLabel>Team Name</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`teams.${index}.capacity`} render={({ field }) => (
                                     <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input type="number" {...field} className="w-24"/></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`teams.${index}.color`} render={({ field }) => (
                                     <FormItem><FormLabel>Color</FormLabel><FormControl><Input type="color" {...field} className="p-1 h-10 w-16" /></FormControl><FormMessage /></FormMessage>
                                )} />
                                <FormField control={form.control} name={`teams.${index}.icon`} render={({ field }) => (
                                     <FormItem><FormLabel>Icon URL</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                                )} />
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeTeam(index)}><Trash2 /></Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>
              ) : sessionType === 'individual' ? (
                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Required Player Fields</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendField({ id: uuidv4(), label: '', type: 'text' })}>
                                <Plus className="mr-2" /> Add Field
                            </Button>
                        </div>
                         <CardDescription>Define the information you want to collect from each player before they start the challenge.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {fieldFields.map((field, index) => (
                             <div key={field.id} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-4 items-end p-4 border rounded-lg">
                                <FormField control={form.control} name={`requiredPlayerFields.${index}.label`} render={({ field }) => (
                                    <FormItem><FormLabel>Field Label</FormLabel><FormControl><Input {...field} placeholder="e.g., Full Name, Email" /></FormControl><FormMessage /></FormItem>
                                )} />
                                <FormField control={form.control} name={`requiredPlayerFields.${index}.type`} render={({ field }) => (
                                    <FormItem><FormLabel>Field Type</FormLabel>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                            <SelectContent>
                                                <SelectItem value="text">Text</SelectItem>
                                                <SelectItem value="email">Email</SelectItem>
                                                <SelectItem value="tel">Phone Number</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    <FormMessage /></FormItem>
                                )} />
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeField(index)}><Trash2 /></Button>
                            </div>
                        ))}
                        {fieldFields.length === 0 && <p className="text-muted-foreground text-sm text-center">No custom fields defined. Players will only be asked for a display name.</p>}
                    </CardContent>
                </Card>
              ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>1v1 Matchmaking</CardTitle>
                        <CardDescription>Players who join this session will be automatically matched for 1v1 games. No further configuration is needed here.</CardDescription>
                    </CardHeader>
                </Card>
              )}


                <Card>
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Custom Questions</CardTitle>
                            <div className="flex gap-2">
                                <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isExtracting}>
                                    {isExtracting ? <Loader2 className="mr-2 animate-spin"/> : <Upload className="mr-2"/>}
                                    Import from PDF
                                </Button>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="application/pdf" className="hidden" />
                                <Button type="button" variant="outline" size="sm" onClick={() => appendQuestion({ question: '', options: ['', '', '', ''], answer: '' })}>
                                    <Plus className="mr-2" /> Add Question
                                </Button>
                            </div>
                        </div>
                        <CardDescription>Add custom multiple-choice questions here. These questions will be used for all game types in this session.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {questionFields.map((field, index) => (
                            <QuestionItem 
                                key={field.id}
                                control={form.control}
                                index={index}
                                removeQuestion={removeQuestion}
                                getValues={form.getValues}
                            />
                        ))}
                         {questionFields.length === 0 && <p className="text-muted-foreground text-sm">No custom questions added. AI will generate them based on topic if left empty.</p>}
                    </CardContent>
                </Card>

              <Button type="submit" size="lg" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting && <Loader2 className="mr-2 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
