import { type Message, StreamData, convertToCoreMessages, streamText } from 'ai';
import { auth } from '@/app/(auth)/auth';
import { customModel } from '@/lib/ai';
import { models } from '@/lib/ai/models';
import { deleteChatById, getChatById, saveChat, saveMessages } from '@/lib/db/queries';
import type { Suggestion } from '@/lib/db/schema';
import { generateUUID, getMostRecentUserMessage } from '@/lib/utils';

import { generateTitleFromUserMessage } from '../../actions';
import {
  createUserElasticSearchPrompt,
  fetchFromElasticsearch,
  generateElasticsearchPrompt,
} from '@/lib/elasticsearch/helper';
import { generateMySQLPrompt, runGenerateSQLQuery } from '@/lib/atlasdb/natural-language-to-mysql';
import { visualizeLogLevels } from '@/lib/tools';

export const maxDuration = 60;

export async function POST(request: Request) {
  const { id, messages, modelId }: { id: string; messages: Array<Message>; modelId: string } = await request.json();

  const session = await auth();

  if (!session || !session.user || !session.user.id) {
    return new Response('Unauthorized', { status: 401 });
  }

  const model = models.find((model) => model.id === modelId);

  if (!model) {
    return new Response('Model not found', { status: 404 });
  }

  const coreMessages = convertToCoreMessages(messages);
  const userMessage = getMostRecentUserMessage(coreMessages);

  if (!userMessage) {
    return new Response('No user message found', { status: 400 });
  }

  const chat = await getChatById({ id });

  if (!chat) {
    const title = await generateTitleFromUserMessage({ message: userMessage });
    await saveChat({ id, userId: session.user.id, title });
  }

  await saveMessages({
    messages: [{ ...userMessage, id: generateUUID(), createdAt: new Date(), chatId: id }],
  });

  // Store search results from different sources
  const searchResults: Record<'elasticsearch' | 'database', any> = {
    elasticsearch: null,
    database: null,
  };

  // FIXME: THIS IS EXPERIMENTAL CODE
  // elasticsearch
  try {
    const optimizedQuery = await generateElasticsearchPrompt(userMessage.content.toString());
    if (!optimizedQuery) {
      return new Response('Failed to generate Elasticsearch prompt', { status: 500 });
    }
    const elasticsearchResults = await fetchFromElasticsearch(optimizedQuery);
    searchResults.elasticsearch = elasticsearchResults;
  } catch (error) {
    console.error('Error fetching from Elasticsearch:', error);
  }

  // FIXME: this is experimental code for visualization of log data
  if (userMessage.content.toString().includes('visualization')) {
    const logData = searchResults.elasticsearch;
    const result = streamText({
      model: customModel(model.apiIdentifier),
      system: `Here is the log data: ${JSON.stringify(logData)}. Use the "visualizeLogs" tool to create a visualization.`,
      messages: coreMessages,
      tools: { visualizeLogs: visualizeLogLevels },
    });

    return result.toDataStreamResponse();
  }

  // FIXME: this is experimental code for fetching from database
  const databaseSearchEnabled = process.env.ENABLE_DATABASE_SEARCH === 'true';
  if (databaseSearchEnabled) {
    try {
      const atlasQuery = await generateMySQLPrompt(userMessage.content.toString());
      const databaseResults = await runGenerateSQLQuery(atlasQuery);
      searchResults.database = databaseResults;
    } catch (error) {
      console.error('Error executing AtlasDB query: ', error);
    }
  }

  const systemPrompt = createUserElasticSearchPrompt(
    JSON.stringify(searchResults.elasticsearch),
    JSON.stringify(searchResults.database),
    userMessage.content.toString()
  );

  const streamingData = new StreamData();

  const result = streamText({
    model: customModel(model.apiIdentifier),
    system: systemPrompt,
    messages: coreMessages,
    maxSteps: 5,
  });

  return result.toDataStreamResponse({
    data: streamingData,
  });
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new Response('Not Found', { status: 404 });
  }

  const session = await auth();

  if (!session || !session.user) {
    return new Response('Unauthorized', { status: 401 });
  }

  try {
    const chat = await getChatById({ id });

    if (chat.userId !== session.user.id) {
      return new Response('Unauthorized', { status: 401 });
    }

    await deleteChatById({ id });

    return new Response('Chat deleted', { status: 200 });
  } catch (error) {
    return new Response('An error occurred while processing your request', {
      status: 500,
    });
  }
}
