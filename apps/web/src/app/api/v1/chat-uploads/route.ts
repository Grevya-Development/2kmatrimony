import type { ChatUploadTicket } from '@2k/shared';
import { chatUploadSchema } from '@2k/shared';
import { errors, parseJson, route } from '@/server/http';
import { isEnabled } from '@/server/config';
import { createUpload } from '@/server/media';
import { requireParticipant } from '@/server/messaging/service';

/** Signed upload URL for an image in a conversation (participants only). */
export const POST = route({ profile: 'active', rateLimit: { name: 'chat-upload', limit: 30, windowSec: 3600 } }, async ({ req, auth }): Promise<ChatUploadTicket> => {
  const body = await parseJson(req, chatUploadSchema);
  if (!(await isEnabled('chat_images'))) throw errors.featureDisabled('Image sharing is currently unavailable.');
  const { conversation } = await requireParticipant(body.conversationId, auth.profile!.id);
  if (conversation.is_locked) throw errors.conflict('This conversation is closed.');
  const up = await createUpload('chat', body.conversationId, body.contentType, body.sizeBytes);
  return { bucket: up.bucket, path: up.path, signedUrl: up.signedUrl, token: up.token };
});
