// Updated environment variables
// src/app/api/orchestrator/route.ts

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Supabase client for server-side operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: NextRequest) {
  console.log('Orchestrator endpoint hit');

  let taskId: string | undefined;

  try {
    const body = await req.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // 1. Log the incoming task to Supabase
    console.log('Step 1: Logging task to Supabase');
    const { data: taskData, error: insertError } = await supabase
      .from('tasks')
      .insert({ prompt: prompt, status: 'processing' })
      .select('id')
      .single();

    if (insertError || !taskData) {
      console.error('Supabase insert error:', insertError);
      throw new Error('Failed to log task to database.');
    }
    taskId = taskData.id;
    console.log(`Task logged with ID: ${taskId}`);

    // 2. Process the task with OpenAI
    console.log('Step 2: Processing with OpenAI');
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful executive assistant.' },
        { role: 'user', content: prompt },
      ],
    });

    const aiResponse = completion.choices[0].message.content;

    // 3. Update the task in Supabase with the response
    console.log('Step 3: Updating task with AI response');
    const { error: updateError } = await supabase
      .from('tasks')
      .update({ response: { result: aiResponse }, status: 'completed' })
      .eq('id', taskId);

    if (updateError) {
      console.error('Supabase update error:', updateError);
      throw new Error('AI processing complete, but failed to update log.');
    }
    
    console.log('Task completed successfully');
    return NextResponse.json({ success: true, taskId: taskId, response: aiResponse }, { status: 200 });

  } catch (error) {
    console.error('An error occurred in the orchestrator:', error);
    
    let errorMessage = 'An unknown error occurred.';
    if (error instanceof Error) {
        errorMessage = error.message;
    }

    if (taskId) {
        await supabase
            .from('tasks')
            .update({ status: 'error', error_message: errorMessage })
            .eq('id', taskId);
    }

    return NextResponse.json({ error: 'An internal server error occurred.', details: errorMessage }, { status: 500 });
  }
}