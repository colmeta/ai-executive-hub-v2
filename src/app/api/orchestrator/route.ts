// src/app/api/orchestrator/route.ts

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// --- AGENT DEFINITIONS ---
// In the future, these agents could be in their own files.

/**
 * The Meeting Agent: Handles tasks related to scheduling.
 * For now, it just confirms it understood the request.
 */
function meetingAgent(prompt: string): string {
  // In the future, this function will parse date/time, check calendars, etc.
  // For now, it returns a structured confirmation message.
  console.log('Routing to: Meeting Agent');
  return `Meeting scheduling initiated. I will schedule a meeting based on the prompt: "${prompt}". Further actions like calendar integration are pending development.`;
}

/**
 * The General Agent: Handles all other tasks using OpenAI.
 */
async function generalAgent(prompt: string, openai: OpenAI): Promise<string> {
  console.log('Routing to: General Agent (OpenAI)');
  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [
      { role: 'system', content: 'You are a helpful executive assistant.' },
      { role: 'user', content: prompt },
    ],
  });
  return completion.choices[0].message.content || 'No response from AI.';
}


// --- CORE INFRASTRUCTURE ---

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


// --- MASTER ORCHESTRATOR ---

export async function POST(req: NextRequest) {
  console.log('Orchestrator endpoint hit');
  let taskId: string;

  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 1. Log the incoming task to Supabase
    const { data: taskData, error: insertError } = await supabase
      .from('tasks')
      .insert({ prompt: prompt, status: 'processing' })
      .select('id')
      .single();

    if (insertError || !taskData) {
      throw new Error('Failed to log task to database.');
    }
    taskId = taskData.id;

    // 2. --- INTELLIGENT ROUTING LOGIC ---
    // This is the new "brain" of the orchestrator.
    let agentResponse: string;
    const lowerCasePrompt = prompt.toLowerCase();

    if (lowerCasePrompt.includes('schedule a meeting') || lowerCasePrompt.includes('meeting with')) {
      // If the prompt is about meetings, route to the Meeting Agent
      agentResponse = meetingAgent(prompt);
    } else {
      // Otherwise, use the General Agent for all other tasks
      agentResponse = await generalAgent(prompt, openai);
    }

    // 3. Update the task in Supabase with the response from the chosen agent
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ response: { result: agentResponse }, status: 'completed' })
      .eq('id', taskId);

    if (updateError) {
      throw new Error('AI processing complete, but failed to update log.');
    }
    
    console.log('Task completed successfully');
    return NextResponse.json({ success: true, taskId: taskId, response: agentResponse }, { status: 200 });

  } catch (error: any) {
    console.error('An error occurred in the orchestrator:', error);
    
    if (taskId!) {
        await supabase
            .from('tasks')
            .update({ status: 'error', error_message: error.message })
            .eq('id', taskId);
    }

    return NextResponse.json({ error: 'An internal server error occurred.', details: error.message }, { status: 500 });
  }
}