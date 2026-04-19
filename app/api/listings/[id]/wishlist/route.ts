import { DELETE as removeFromWishlist, POST as addToWishlist } from '../../../wishlist/[id]/route';

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return addToWishlist(request, context);
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  return removeFromWishlist(request, context);
}
