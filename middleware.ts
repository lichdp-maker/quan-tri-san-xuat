import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const CONG_KHAI = ['/dang-nhap']

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl
  if (CONG_KHAI.some((p) => pathname.startsWith(p))) return NextResponse.next()

  const token = req.cookies.get('phien')?.value
  if (token && process.env.AUTH_SECRET) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.AUTH_SECRET))
      return NextResponse.next()
    } catch {
      // token hỏng hoặc hết hạn -> về trang đăng nhập
    }
  }

  const url = req.nextUrl.clone()
  url.pathname = '/dang-nhap'
  url.search = ''
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|webmanifest)$).*)'],
}
