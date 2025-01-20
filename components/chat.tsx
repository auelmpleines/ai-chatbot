'use client';

import type { Attachment, Message } from 'ai';
import { AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { useWindowSize } from 'usehooks-ts';

import { ChatHeader } from '@/components/chat-header';
import type { Vote } from '@/lib/db/schema';
import { fetcher } from '@/lib/utils';

import { Block, type UIBlock } from './block';
import { BlockStreamHandler } from './block-stream-handler';
import { MultimodalInput } from './multimodal-input';
import { Messages } from './messages';
import { useChat } from 'ai/react';
import { MonthlyLogLevelChart, monthNames } from './Charts';

export function Chat({
  id,
  initialMessages,
  selectedModelId,
}: {
  id: string;
  initialMessages: Array<Message>;
  selectedModelId: string;
}) {
  const { mutate } = useSWRConfig();

  const {
    messages,
    setMessages,
    handleSubmit,
    input,
    setInput,
    append,
    isLoading,
    stop,
    data: streamingData,
  } = useChat({
    body: { id, modelId: selectedModelId },
    initialMessages,
    onFinish: () => {
      mutate('/api/history');
    },
  });

  const { width: windowWidth = 1920, height: windowHeight = 1080 } = useWindowSize();

  const [block, setBlock] = useState<UIBlock>({
    documentId: 'init',
    content: '',
    title: '',
    status: 'idle',
    isVisible: false,
    boundingBox: {
      top: windowHeight / 4,
      left: windowWidth / 4,
      width: 250,
      height: 50,
    },
  });

  const { data: votes } = useSWR<Array<Vote>>(`/api/vote?chatId=${id}`, fetcher);

  const [attachments, setAttachments] = useState<Array<Attachment>>([]);

  const chartData = [
    { month: new Date().getMonth(), timestamp: new Date(), message: 'test message', log_level: 'INFO' },
    { month: new Date().getMonth(), timestamp: new Date(), message: 'test message 2', log_level: 'WARN' },
    { month: new Date().getMonth(), timestamp: new Date(), message: 'test message', log_level: 'DEBUG' },
    { month: new Date().getMonth() + 1, timestamp: new Date(), message: 'test message', log_level: 'INFO' },
    { month: new Date().getMonth() + 2, timestamp: new Date(), message: 'test message 2', log_level: 'WARN' },
    { month: new Date().getMonth() + 6, timestamp: new Date(), message: 'test message', log_level: 'DEBUG' },
  ];

  const chartDataReduced = chartData.reduce<
    Array<{
      month: string;
      INFO: number;
      WARN: number;
      DEBUG: number;
    }>
  >((acc, curr) => {
    const month = monthNames[curr.month % 12];
    const existingIndex = acc.findIndex((item) => item.month === month);

    if (existingIndex === -1) {
      acc.push({
        month,
        INFO: curr.log_level === 'INFO' ? 1 : 0,
        WARN: curr.log_level === 'WARN' ? 1 : 0,
        DEBUG: curr.log_level === 'DEBUG' ? 1 : 0,
      });
    } else {
      const existingMonthRecord = acc[existingIndex];
      acc[existingIndex] = {
        ...existingMonthRecord,
        [curr.log_level as keyof typeof existingMonthRecord]:
          existingMonthRecord[curr.log_level as keyof typeof existingMonthRecord] + 1,
      };
    }

    return acc;
  }, []);

  return (
    <>
      <div className="flex flex-col min-w-0 h-dvh bg-background">
        <ChatHeader selectedModelId={selectedModelId} />

        <Messages
          chatId={id}
          block={block}
          setBlock={setBlock}
          isLoading={isLoading}
          votes={votes}
          messages={messages}
        />

        <form className="flex mx-auto px-4 bg-background pb-4 md:pb-6 gap-2 w-full md:max-w-3xl">
          <MultimodalInput
            chatId={id}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            messages={messages}
            setMessages={setMessages}
            append={append}
          />
        </form>
      </div>

      <MonthlyLogLevelChart data={chartDataReduced} />

      <AnimatePresence>
        {block?.isVisible && (
          <Block
            chatId={id}
            input={input}
            setInput={setInput}
            handleSubmit={handleSubmit}
            isLoading={isLoading}
            stop={stop}
            attachments={attachments}
            setAttachments={setAttachments}
            append={append}
            block={block}
            setBlock={setBlock}
            messages={messages}
            setMessages={setMessages}
            votes={votes}
          />
        )}
      </AnimatePresence>

      <BlockStreamHandler streamingData={streamingData} setBlock={setBlock} />
    </>
  );
}
