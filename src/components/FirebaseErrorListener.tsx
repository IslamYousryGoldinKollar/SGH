
'use client';

import { useEffect } from 'react';
import { errorEmitter } from '@/firebase/error-emitter';
import type { FirestorePermissionError } from '@/firebase/errors';
import { useToast } from '@/hooks/use-toast';


// This is a client-side component that will listen for the custom error events.
export function FirebaseErrorListener() {
    const { toast } = useToast();

    useEffect(() => {
        const handleError = (error: FirestorePermissionError) => {
            console.error(
                "Firestore Permission Error Caught by Listener:",
                {
                    message: error.message,
                    path: error.context.path,
                    operation: error.context.operation,
                    data: error.context.requestResourceData,
                }
            );

            // Here you can use a toast or any other UI element to display the error.
            // In a real app, you might only show this in a development environment.
             if (process.env.NODE_ENV === 'development') {
                toast({
                    variant: 'destructive',
                    title: 'Firestore Security Rule Error',
                    description: `Operation: ${error.context.operation} on path: ${error.context.path} was denied. Check the console for details.`,
                    duration: 10000,
                });

                // Throwing the error here will display it in Next.js's development overlay
                throw error;
            }
        };

        errorEmitter.on('permission-error', handleError);

        return () => {
            errorEmitter.off('permission-error', handleError);
        };
    }, [toast]);

    return null; // This component does not render anything.
}
