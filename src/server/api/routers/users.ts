"use server";
import { db } from "@/server/db";
import { user } from "@/server/db/schema/auth";
import { auth } from "@lib/auth"
import { authClient } from "@lib/auth-client";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

export const getCurrentUser = async () => {
    const session = await auth.api.getSession({
        headers: await headers()
    })

    if(!session){
        redirect("/login");
    }

    const currentUser = await db.query.user.findFirst({
        where: eq(user.id,session.user.id)
    })

    if(!currentUser){
        redirect("/login");
    }

    return {
        ...session,
        currentUser
    };
}

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