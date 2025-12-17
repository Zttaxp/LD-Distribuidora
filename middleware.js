import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'

export async function middleware(request) {
  // 1. Prepara a resposta padrão (Deixar passar)
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 2. Configura o cliente apenas para garantir que o cookie da sessão
  // seja renovado e esteja disponível para o Server Component (page.js)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 3. Atualiza a sessão no Supabase (Isso renova o token se necessário)
  await supabase.auth.getUser()

  // 4. RETORNA SEMPRE A RESPOSTA (SEM REDIRECTS)
  // Deixamos o redirecionamento por conta do arquivo app/page.js
  // Isso acaba com o Loop Infinito.
  return response
}

export const config = {
  matcher: [
    /*
     * Aplica em todas as rotas, exceto arquivos estáticos e imagens
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}