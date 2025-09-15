"use server";
import { auth } from "@lib/auth"
import { authClient } from "@lib/auth-client";

export const signIn = async (email: string, password: string) => {
    try{
        await auth.api.signInEmail({
            body: {
                email,
                password,
            }
        })

        return{
            success: true,
            message: "Signed in successfully"
        }
    }
    catch(err){
        const e = err as Error
        return{
            success: false,
            message: e.message || "Error signing in" 
        }
    }
}


export const signUp = async (email: string, password: string, username: string) => {
    try{
        await auth.api.signUpEmail({
            body: {
                email,
                password,
                name: username
            }
        })

        return{
            success: true,
            message: "Signed up successfully"
        }
    }
    catch(err){
        const e = err as Error
        return{
            success: false,
            message: e.message || "Error signing up" 
        }
    }
}

export const signOut = async () => {
    try{
        await authClient.signOut()

        return{
            success: true,
            message: "Signed out successfully"
        }
    }
    catch(err){
        const e = err as Error
        return{
            success: false,
            message: e.message || "Error signing out" 
        }
    }
}