
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useForm, useFieldArray, type Control } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import type { Game } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

const sessionSchema = z.object({
  topic: z.string().min(2, "Topic must be at least 2 characters."),
  difficulty: z.enum(["easy", "medium", "hard"]),
  timer: z.coerce.number().min(30, "Timer must be at least 30 seconds."),
  teams: z.array(z.object({
    name: z.string().min(1, "Team name is required."),
    capacity: z.coerce.number().min(1, "Capacity must be at least 1."),
  })).min(1, "At least one team is required."),
  questions: z.array(z.object({
      question: z.string().min(1, "Question text is required."),
      options: z.array(z.string().min(1, "Option text is required.")).min(2, "At least two options are required.").max(4, "You can have a maximum of 4 options."),
      answer: z.string().min(1, "An answer is required."),
      difficulty: z.enum(['easy', 'medium', 'hard']),
      topic: z.string().min(1),
  })),
});

type SessionFormValues = z.infer<typeof sessionSchema>;

// New component for rendering a single question's form fields
function QuestionItem({ control, index, removeQuestion, getValues }: { control: Control<SessionFormValues>, index: number, removeQuestion: (index: number) => void, getValues: any }) {
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
                  <FormLabel>Options & Correct Answer</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                      {optionFields.map((optionField, optionIndex) => (
                        <FormField
                          key={optionField.id}
                          control={control}
                          name={`questions.${index}.options.${optionIndex}`}
                          render={({ field: optionField }) => (
                            <FormItem className="flex items-center space-x-3 space-y-0">
                              <FormControl>
                                <RadioGroupItem value={getValues(`questions.${index}.options.${optionIndex}`)} />
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

            <div className="grid grid-cols-2 gap-4">
              <FormField control={control} name={`questions.${index}.difficulty`} render={({ field }) => (
                  <FormItem><FormLabel>Difficulty</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl><SelectTrigger><SelectValue/></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="easy">Easy</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="hard">Hard</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
              )}/>
              <FormField control={control} name={`questions.${index}.topic`} render={({ field }) => (
                  <FormItem><FormLabel>Topic</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
              )}/>
            </div>
        </div>
    );
}


export default function SessionConfigPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const gameId = params.gameId as string;
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);

  const form = useForm<SessionFormValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
        topic: 'General Knowledge',
        difficulty: 'medium',
        timer: 300,
        teams: [],
        questions: [],
    }
  });
  
  const { fields: teamFields, append: appendTeam, remove: removeTeam } = useFieldArray({
    control: form.control,
    name: "teams",
  });

  const { fields: questionFields, append: appendQuestion, remove: removeQuestion } = useFieldArray({
    control: form.control,
    name: "questions",
  });

  useEffect(() => {
    if (!gameId) return;
    const gameRef = doc(db, "games", gameId);
    getDoc(gameRef).then((docSnap) => {
      if (docSnap.exists()) {
        const gameData = docSnap.data() as Game;
        setGame(gameData);
        form.reset({
          topic: gameData.topic,
          difficulty: gameData.difficulty,
          timer: gameData.timer,
          teams: gameData.teams.map(t => ({ name: t.name, capacity: t.capacity })),
          questions: gameData.questions.map(q => ({...q, options: q.options || []})), // Ensure options is an array
        });
      }
      setLoading(false);
    });
  }, [gameId, form]);

  const onSubmit = async (data: SessionFormValues) => {
    try {
        const gameRef = doc(db, "games", gameId);
        // Reset players and score when config is updated.
        const teams = data.teams.map(t => ({ ...t, score: 0, players: [] }));
        await updateDoc(gameRef, { ...data, teams });
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

  if (loading) {
    return <div className="flex h-screen items-center justify-center"><Loader2 className="h-16 w-16 animate-spin" /></div>;
  }
  if (!game) {
    return <div className="flex h-screen items-center justify-center"><h1 className="text-2xl">Game session not found.</h1></div>;
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="font-display">Configure Session: {game.id}</CardTitle>
          <CardDescription>Edit the details for this trivia game session.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              
              <Card className="bg-card/50">
                <CardHeader><CardTitle>General Settings</CardTitle></CardHeader>
                <CardContent className="grid md:grid-cols-3 gap-6">
                    <FormField control={form.control} name="topic" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Topic (for AI Questions)</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                        </FormItem>
                    )} />
                    <FormField control={form.control} name="difficulty" render={({ field }) => (
                        <FormItem>
                            <FormLabel>Difficulty</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                                <SelectContent>
                                    <SelectItem value="easy">Easy</SelectItem>
                                    <SelectItem value="medium">Medium</SelectItem>
                                    <SelectItem value="hard">Hard</SelectItem>
                                </SelectContent>
                            </Select>
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
                </CardContent>
              </Card>

                <Card className="bg-card/50">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Teams</CardTitle>
                            <Button type="button" variant="outline" size="sm" onClick={() => appendTeam({ name: `Team ${teamFields.length + 1}`, capacity: 10 })}>
                                <Plus className="mr-2" /> Add Team
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {teamFields.map((field, index) => (
                            <div key={field.id} className="flex gap-4 items-center p-4 border rounded-lg">
                                <FormField control={form.control} name={`teams.${index}.name`} render={({ field }) => (
                                    <FormItem className="flex-1"><FormLabel>Team Name</FormLabel><FormControl><Input {...field} /></FormControl></FormItem>
                                )} />
                                <FormField control={form.control} name={`teams.${index}.capacity`} render={({ field }) => (
                                     <FormItem><FormLabel>Capacity</FormLabel><FormControl><Input type="number" {...field} /></FormControl></FormItem>
                                )} />
                                <Button type="button" variant="destructive" size="icon" onClick={() => removeTeam(index)}><Trash2 /></Button>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                <Card className="bg-card/50">
                    <CardHeader>
                        <div className="flex justify-between items-center">
                            <CardTitle>Custom Questions</CardTitle>
                             <Button type="button" variant="outline" size="sm" onClick={() => appendQuestion({ question: '', options: ['', '', '', ''], answer: '', difficulty: 'medium', topic: form.getValues('topic') })}>
                                <Plus className="mr-2" /> Add Question
                            </Button>
                        </div>
                        <CardDescription>Add custom multiple-choice questions here. If left empty, questions will be generated by AI.</CardDescription>
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
                         {questionFields.length === 0 && <p className="text-muted-foreground text-sm">No custom questions added. AI will generate them based on topic.</p>}
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
