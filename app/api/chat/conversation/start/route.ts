import { POST as startConversation } from '../../conversations/route';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  return startConversation(request);
}
