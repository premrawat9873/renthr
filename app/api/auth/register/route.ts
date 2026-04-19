import { NextResponse } from 'next/server';
import { hashPassword } from '@/lib/password';
import { prisma } from '@/lib/prisma';

const MIN_PASSWORD_LENGTH = 8;

type RegisterRequestBody = {
  email?: unknown;
  password?: unknown;
  name?: unknown;
};

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as RegisterRequestBody;
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const password = typeof body.password === 'string' ? body.password : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 });
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser?.passwordHash) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }

    const passwordHash = await hashPassword(password);

    if (existingUser) {
      const updatedUser = await prisma.user.update({
        where: { id: existingUser.id },
        data: {
          passwordHash,
          name: name || existingUser.name,
        },
        select: {
          id: true,
          email: true,
          name: true,
          phone: true,
          isVerified: true,
        },
      });

      return NextResponse.json(
        {
          user: {
            id: String(updatedUser.id),
            email: updatedUser.email,
            name: updatedUser.name,
            phone: updatedUser.phone,
            isVerified: updatedUser.isVerified,
          },
        },
        { status: 200 }
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        name: name || null,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        isVerified: true,
      },
    });

    return NextResponse.json(
      {
        user: {
          id: String(user.id),
          email: user.email,
          name: user.name,
          phone: user.phone,
          isVerified: user.isVerified,
        },
      },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to create account right now.' }, { status: 500 });
  }
}
