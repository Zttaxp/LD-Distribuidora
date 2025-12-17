import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function middleware(request) {
  // 1. Prepara a resposta base
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  // 2. Configura o cliente Supabase
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // 3. Verifica o usuário (Isso atualiza o cookie de sessão automaticamente)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 4. Proteção de Rota Simplificada
  // Se NÃO tem usuário e NÃO está na página de login, manda pro Login.
  if (!user && !request.nextUrl.pathname.startsWith("/login")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // REMOVI a regra que mandava usuário logado de volta pra home.
  // Isso evita o loop. Se ele estiver logado e for pro login, ele verá o login (sem problemas).

  return response;
}

export const config = {
  matcher: [
    /*
     * Ignora arquivos estáticos para não travar o carregamento
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};