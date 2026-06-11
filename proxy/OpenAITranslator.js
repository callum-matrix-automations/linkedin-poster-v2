const { Transform } = require('stream');
const crypto = require('crypto');
const Logger = require('./Logger');

class OpenAITranslator {

  static MODEL_MAP = {
    'gpt-4o':             'claude-sonnet-4-6',
    'gpt-4o-mini':        'claude-haiku-4-5-20251001',
    'gpt-4-turbo':        'claude-sonnet-4-6',
    'gpt-4':              'claude-sonnet-4-6',
    'gpt-3.5-turbo':      'claude-haiku-4-5-20251001',
    'o1':                 'claude-opus-4-6',
    'o1-mini':            'claude-sonnet-4-6',
    'o1-preview':         'claude-opus-4-6',
    'o3':                 'claude-opus-4-6',
    'o3-mini':            'claude-sonnet-4-6',
    'o4-mini':            'claude-sonnet-4-6',
  };

  static AVAILABLE_MODELS = [
    'claude-opus-4-6',
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-sonnet-4-5-20250929',
    'claude-opus-4-5-20251101',
    'claude-opus-4-1-20250805',
    'claude-sonnet-4-20250514',
    'claude-opus-4-20250514',
  ];

  static resolveModel(openaiModel) {
    return OpenAITranslator.MODEL_MAP[openaiModel] || openaiModel;
  }

  static generateRequestId() {
    return 'chatcmpl-' + crypto.randomBytes(12).toString('base64url');
  }

  static translateRequest(openaiBody) {
    const anthropicBody = {};

    anthropicBody.model = OpenAITranslator.resolveModel(openaiBody.model);

    const systemParts = [];
    const messages = [];
    let pendingToolResults = [];

    for (const msg of (openaiBody.messages || [])) {
      if (msg.role === 'system') {
        const text = typeof msg.content === 'string'
          ? msg.content
          : (Array.isArray(msg.content)
              ? msg.content.map(c => c.text || '').join('\n')
              : String(msg.content));
        systemParts.push({ type: 'text', text });
      } else if (msg.role === 'assistant' && msg.tool_calls) {
        if (pendingToolResults.length > 0) {
          messages.push({ role: 'user', content: pendingToolResults });
          pendingToolResults = [];
        }
        const content = [];
        if (msg.content) {
          content.push({ type: 'text', text: msg.content });
        }
        for (const tc of msg.tool_calls) {
          content.push({
            type: 'tool_use',
            id: tc.id,
            name: tc.function.name,
            input: typeof tc.function.arguments === 'string'
              ? JSON.parse(tc.function.arguments)
              : tc.function.arguments,
          });
        }
        messages.push({ role: 'assistant', content });
      } else if (msg.role === 'tool') {
        pendingToolResults.push({
          type: 'tool_result',
          tool_use_id: msg.tool_call_id,
          content: typeof msg.content === 'string' ? msg.content : JSON.stringify(msg.content),
        });
      } else {
        if (pendingToolResults.length > 0) {
          messages.push({ role: 'user', content: pendingToolResults });
          pendingToolResults = [];
        }
        const role = msg.role === 'assistant' ? 'assistant' : 'user';
        const content = typeof msg.content === 'string'
          ? msg.content
          : msg.content;
        messages.push({ role, content });
      }
    }

    if (pendingToolResults.length > 0) {
      messages.push({ role: 'user', content: pendingToolResults });
    }

    anthropicBody.messages = OpenAITranslator._mergeConsecutiveMessages(messages);

    if (systemParts.length > 0) {
      anthropicBody.system = systemParts;
    }

    anthropicBody.max_tokens = openaiBody.max_tokens
      || openaiBody.max_completion_tokens
      || 8192;

    if (openaiBody.temperature !== undefined) {
      anthropicBody.temperature = openaiBody.temperature;
    }
    if (openaiBody.top_p !== undefined) {
      anthropicBody.top_p = openaiBody.top_p;
    }
    if (openaiBody.stop !== undefined) {
      anthropicBody.stop_sequences = Array.isArray(openaiBody.stop)
        ? openaiBody.stop
        : [openaiBody.stop];
    }

    if (openaiBody.stream === true) {
      anthropicBody.stream = true;
    }

    if (openaiBody.tools && Array.isArray(openaiBody.tools)) {
      anthropicBody.tools = openaiBody.tools
        .filter(t => t.type === 'function' && t.function)
        .map(t => ({
          name: t.function.name,
          description: t.function.description || '',
          input_schema: t.function.parameters || { type: 'object', properties: {} },
        }));
    }

    const ignoredParams = [
      'presence_penalty', 'frequency_penalty', 'logprobs',
      'top_logprobs', 'logit_bias', 'n', 'seed', 'user',
      'service_tier', 'store', 'metadata', 'response_format',
      'stream_options',
    ];
    for (const param of ignoredParams) {
      if (openaiBody[param] !== undefined) {
        Logger.debug(`OpenAI param '${param}' ignored (not supported by Anthropic)`);
      }
    }

    return anthropicBody;
  }

  static _mergeConsecutiveMessages(messages) {
    if (messages.length === 0) return messages;

    const merged = [{ ...messages[0] }];

    for (let i = 1; i < messages.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = messages[i];

      if (curr.role === prev.role) {
        const prevText = typeof prev.content === 'string'
          ? prev.content : JSON.stringify(prev.content);
        const currText = typeof curr.content === 'string'
          ? curr.content : JSON.stringify(curr.content);
        prev.content = prevText + '\n\n' + currText;
      } else {
        merged.push({ ...curr });
      }
    }

    return merged;
  }

  static translateResponse(anthropicJson, requestModel) {
    const textContent = (anthropicJson.content || [])
      .filter(block => block.type === 'text')
      .map(block => block.text)
      .join('');

    const toolUseBlocks = (anthropicJson.content || []).filter(block => block.type === 'tool_use');
    const toolCalls = toolUseBlocks.length > 0
      ? toolUseBlocks.map((block, index) => ({
          id: block.id,
          type: 'function',
          function: {
            name: block.name,
            arguments: JSON.stringify(block.input),
          },
        }))
      : undefined;

    const finishReason = OpenAITranslator._mapStopReason(anthropicJson.stop_reason);

    const inputTokens = anthropicJson.usage?.input_tokens || 0;
    const outputTokens = anthropicJson.usage?.output_tokens || 0;

    const message = {
      role: 'assistant',
      content: textContent || null,
    };
    if (toolCalls) {
      message.tool_calls = toolCalls;
    }

    return {
      id: OpenAITranslator.generateRequestId(),
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: requestModel || anthropicJson.model,
      choices: [{
        index: 0,
        message,
        finish_reason: finishReason,
      }],
      usage: {
        prompt_tokens: inputTokens,
        completion_tokens: outputTokens,
        total_tokens: inputTokens + outputTokens,
      },
    };
  }

  static _mapStopReason(anthropicStopReason) {
    const map = {
      'end_turn': 'stop',
      'stop_sequence': 'stop',
      'max_tokens': 'length',
      'tool_use': 'tool_calls',
    };
    return map[anthropicStopReason] || 'stop';
  }

  static createStreamTransform(requestId, requestModel) {
    let buffer = '';
    let sentRole = false;
    let inputTokens = 0;
    let outputTokens = 0;

    const makeChunk = (delta, finishReason, usage) => {
      const chunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: requestModel,
        choices: [{
          index: 0,
          delta: delta,
          finish_reason: finishReason || null,
        }],
      };
      if (usage) {
        chunk.usage = usage;
      }
      return chunk;
    };

    const processEvent = (data) => {
      const chunks = [];

      switch (data.type) {
        case 'message_start':
          if (!sentRole) {
            chunks.push(makeChunk({ role: 'assistant' }));
            sentRole = true;
          }
          inputTokens = data.message?.usage?.input_tokens || 0;
          break;

        case 'content_block_delta':
          if (data.delta?.type === 'text_delta' && data.delta.text) {
            chunks.push(makeChunk({ content: data.delta.text }));
          }
          break;

        case 'message_delta':
          outputTokens = data.usage?.output_tokens || outputTokens;
          chunks.push(makeChunk(
            {},
            OpenAITranslator._mapStopReason(data.delta?.stop_reason),
            {
              prompt_tokens: inputTokens,
              completion_tokens: outputTokens,
              total_tokens: inputTokens + outputTokens,
            }
          ));
          break;

        case 'message_stop':
          chunks.push('[DONE]');
          break;

        default:
          break;
      }

      return chunks;
    };

    const processLines = (self, text) => {
      const events = text.split('\n\n');
      buffer = events.pop() || '';

      for (const event of events) {
        const lines = event.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const dataStr = line.substring(6).trim();
          if (!dataStr) continue;

          let data;
          try {
            data = JSON.parse(dataStr);
          } catch (e) {
            Logger.debug('Failed to parse Anthropic SSE data:', dataStr);
            continue;
          }

          const openaiChunks = processEvent(data);
          for (const c of openaiChunks) {
            if (c === '[DONE]') {
              self.push('data: [DONE]\n\n');
            } else {
              self.push('data: ' + JSON.stringify(c) + '\n\n');
            }
          }
        }
      }
    };

    const transform = new Transform({
      transform(chunk, encoding, callback) {
        buffer += chunk.toString();
        processLines(this, buffer);
        buffer = buffer;
        callback();
      },

      flush(callback) {
        if (buffer.trim()) {
          processLines(this, buffer + '\n\n');
        }
        callback();
      }
    });

    return transform;
  }

  static getModelsResponse() {
    return {
      object: 'list',
      data: OpenAITranslator.AVAILABLE_MODELS.map(id => ({
        id: id,
        object: 'model',
        created: Math.floor(Date.now() / 1000),
        owned_by: 'anthropic',
      })),
    };
  }
}

module.exports = OpenAITranslator;
