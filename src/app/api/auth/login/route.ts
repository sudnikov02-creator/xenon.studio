import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import prisma from "@/lib/prisma";
import {
  verifyPassword,
  createToken,
  AUTH_COOKIE,
  AUTH_COOKIE_MAX_AGE,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Некорректный формат запроса" },
      { status: 400 }
    );
  }

  const { email, password } = (body ?? {}) as {
    email?: unknown;
    password?: unknown;
  };

  if (
    typeof email !== "string" ||
    typeof password !== "string" ||
    !email.trim() ||
    !password
  ) {
    return NextResponse.json(
      { error: "Email и пароль обязательны" },
      { status: 400 }
    );
  }

  const normalizedEmail = email.trim().toLowerCase();

  const photographer = await prisma.photographer.findUnique({
    where: { email: normalizedEmail },
  });

  if (!photographer) {
    return NextResponse.json(
      { error: "Неверный email или пароль" },
      { status: 401 }
    );
  }

  const valid = await verifyPassword(password, photographer.hashedPassword);
  if (!valid) {
    return NextResponse.json(
      { error: "Неверный email или пароль" },
      { status: 401 }
    );
  }

  const token = createToken({
    id: photographer.id,
    email: photographer.email,
    name: photographer.name,
  });

  const response = NextResponse.json({ ok: true, name: photographer.name });
  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: AUTH_COOKIE_MAX_AGE,
  });

  return response;
}
