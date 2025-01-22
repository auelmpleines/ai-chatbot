import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

export const createUserElasticSearchPrompt = (elasticsearchResults: string, dbResults: string, userQuery: string) => `
  You are a conversational assistant. Construct a clear and informative response to the user message: "${userQuery}"

  You have access to two data sources:

  Elasticsearch results:
  "${elasticsearchResults}"

  Database results:
  "${dbResults}"

  Your response should:
  1. Analyze both data sources and determine which one(s) contain relevant information for the query
  2. If Elasticsearch results are relevant, use them as your primary source
  3. If database results are relevant, incorporate that information
  4. If both sources have relevant information, combine them coherently
  5. If neither source has relevant information, politely indicate that you cannot help with this specific query
  6. Present information in a user-friendly tone, avoiding technical jargon unless necessary
  7. Include links or metadata from the results when available
  8. Avoid speculating or including information not present in the results
  9. Always answer in the same language as the user's query
  10. Only provide information that is directly supported by either data source
`;

export const getElasticsearchResults = async (query: string) => {
  return fetch('/api/elasticsearch', {
    method: 'POST',
    body: query,
  });
};

export const generateQuery = (
  message: string
) => ` You are an expert in generating optimized Elasticsearch queries. Your task is as follows: 
1. Generate an Elasticsearch query that retrieves the most relevant documents based on the user's message: "${message}". 
2. Adjust the query_string.query dynamically to optimize relevance based on the user's intent.
3. If the user's message includes time-related terms (e.g., "last month," "last year," or specific dates), interpret them and include a date range filter using the "@timestamp" field. 
4. Avoid including any unnecessary fields or filters that do not directly contribute to improving the query results. 
5. Return only a valid JSON object in the following structure: 
{ 
  "query": { 
    "query_string": { 
      "query": ${JSON.stringify(message)}, 
    } 
  }, 
  "filter": { 
    "range": { 
      "@timestamp": { 
        "gte": "START_DATE", // Replace with actual start date if relevant
        "lte": "END_DATE"    // Replace with actual end date if relevant
      } 
    } 
  }, 
  "sort": [ 
    { 
      "@timestamp": { 
        "order": "desc" 
      } 
    } 
  ], 
  "size": 100
} 
6. Sort by relevance using the '@timestamp' field and prioritize accuracy by boosting fields or refining filters based on the user's input. 
7. Absolutely no explanations, comments, or text outside the JSON object should be included.`;

async function getOptimizedQuery(elasticsearchPrompt: string): Promise<string | null> {
  try {
    const { text: optimizedElasticsearchQuery } = await generateText({
      model: openai('gpt-4'),
      prompt: elasticsearchPrompt,
    });
    return optimizedElasticsearchQuery;
  } catch (error) {
    console.error('Error generating text for Elasticsearch prompt:', error);
    return null;
  }
}

export type ElasticsearchQuery = {
  query: {
    multi_match: {
      query: string;
      fields: string[];
    };
  };
  sort: Array<{
    '@timestamp': {
      order: 'desc' | 'asc';
    };
  }>;
};

export async function generateElasticsearchPrompt(message: string): Promise<ElasticsearchQuery | null> {
  try {
    const elasticsearchPrompt = generateQuery(message);
    const optimizedQuery = await getOptimizedQuery(elasticsearchPrompt);

    if (!optimizedQuery) {
      console.error('Optimized Elasticsearch query is empty or null.');
      return null;
    }

    const parsedQuery: ElasticsearchQuery = JSON.parse(optimizedQuery);
    return parsedQuery;
  } catch (error) {
    console.error('Error generating Elasticsearch prompt:', error);
    return null;
  }
}

export async function fetchFromElasticsearch(query: ElasticsearchQuery): Promise<any> {
  console.log('fetching from elasticsearch with query:', JSON.stringify(query));
  const response = await fetch('http://localhost:9200/logs-*/_search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Basic ' + btoa('elastic:changeme'), // Replace with your actual username and password
    },
    body: JSON.stringify(query),
  });

  if (!response.ok) {
    throw new Error(`Elasticsearch error: ${response.statusText}`);
  }

  return response.json();
}

// FIXME: currently only necessary types are included, there are more fields in the response from elasticsearch
export type ElasticsearchResponse = {
  hits: {
    hits: Array<{
      _source: {
        '@timestamp': string;
        log_level: string;
        message: string;
      };
    }>;
  };
};
