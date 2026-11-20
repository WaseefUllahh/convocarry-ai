import { ConversationNode } from '@convocarry/shared-types';

export function generateStructuredSummary(
  platform: string, 
  accountLabel: string | null, 
  nodes: ConversationNode[]
): ConversationNode[] {
  const summaryNodes: ConversationNode[] = [];

  const sourceStr = accountLabel ? `${platform} (${accountLabel})` : platform;
  
  // Try to find the first meaningful user request
  const firstUserRequest = nodes.find(n => n.role === 'user')?.text || 'Unknown context';
  
  // Try to find the last user request
  const lastUserNode = [...nodes].reverse().find(n => n.role === 'user');
  const lastRequest = lastUserNode?.text || 'None';

  // Check for any assistant responses that look like decisions or code
  const assistantNodes = nodes.filter(n => n.role === 'assistant');
  const codeBlocks = assistantNodes.filter(n => n.text.includes('```')).length;
  const decisions = codeBlocks > 0 
    ? `Generated ${codeBlocks} code block(s).` 
    : 'Provided general assistance and context.';

  const summaryText = `[CARRY CARD SUMMARY]

## Source
Captured from: ${sourceStr}

## Main Objective
${firstUserRequest.split('\n')[0].substring(0, 100)}...

## Key Decisions / Output
${decisions}

## Last User Request
${lastRequest.split('\n')[0].substring(0, 100)}...

## Continuation Instructions
Please read the above context and wait for my next specific prompt.`;

  summaryNodes.push({
    role: 'system',
    text: summaryText,
    timestamp: new Date().toISOString()
  });

  return summaryNodes;
}

export function generateTitle(nodes: ConversationNode[]): string {
  const firstUser = nodes.find(n => n.role === 'user');
  if (!firstUser) return 'Untitled Carry Card';
  
  // Grab the first 40 chars of the first user message
  let title = firstUser.text.trim().split('\n')[0].substring(0, 40);
  if (firstUser.text.length > 40) title += '...';
  
  return title;
}

export function generateInjectionText(
  mode: 'summary' | 'full_continuation',
  nodes: ConversationNode[],
  rawSnapshot?: ConversationNode[]
): string {
  if (mode === 'summary') {
    // Return only the system context body
    const systemNode = nodes.find(n => n.role === 'system');
    return systemNode?.text || 'No summary available.';
  }

  if (mode === 'full_continuation') {
    // Reconstruct the transcript from the raw snapshot (or contextBody if no raw exists)
    const candidates = (rawSnapshot && rawSnapshot.length > 0) ? rawSnapshot : nodes;
    const transcriptNodes = candidates.filter(node => !(node.role === 'system' && node.text.includes('[CARRY CARD SUMMARY]')));
    if (!transcriptNodes.some(node => node.role === 'user' || node.role === 'assistant')) {
      throw new Error('This card has no saved transcript. Recapture the chat to use Full Continuation, or choose Summary.');
    }
    
    let text = `Continuing a previous AI conversation from another account/profile. Here is the conversation so far:\n\n---\n`;
    
    transcriptNodes.forEach((node, i) => {
      // Skip the summary system prompt if it snuck in
      if (node.role === 'system' && node.text.includes('[CARRY CARD SUMMARY]')) return;
      
      const roleStr = node.role.toUpperCase();
      text += `[${roleStr}]\n${node.text}\n\n`;
    });
    
    text += `---\nPlease continue from here and preserve the same goals, constraints, and decisions.`;
    return text;
  }

  return '';
}
