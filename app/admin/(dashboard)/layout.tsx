import Link from "next/link";
import { Home, FileStack } from "lucide-react";
import Image from "next/image";
import { SignOutButton } from "@/components/SignOutButton";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#FAF6F0] flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-accent/20 bg-white/90 backdrop-blur-md shadow-sm">
        <div className="container mx-auto flex h-20 items-center justify-between px-4 md:px-8 max-w-7xl">
          <div className="flex items-center gap-8 lg:gap-12">
            <Link href="/admin/dashboard" className="flex items-center gap-3 transition-transform hover:scale-105">
              <div className="bg-primary/5 p-1.5 rounded-full border border-accent/30 shadow-sm">
                <Image src="https://res.cloudinary.com/dm3zixaz4/image/upload/v1772567328/PMK_LOGO-removebg-preview_oydcdq.avif" alt="PMK Logo" width={36} height={36} className="drop-shadow-sm" priority />
              </div>
              <span className="hidden sm:inline-block font-serif font-bold text-xl text-primary tracking-tight">PMK Admin</span>
            </Link>

            <nav className="flex items-center space-x-1 md:space-x-2 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
              <Link
                href="/admin/dashboard"
                className="transition-colors hover:bg-highlight hover:text-primary text-foreground flex items-center px-4 py-2.5 rounded-xl font-medium text-sm border border-transparent hover:border-accent/40 whitespace-nowrap"
              >
                <Home className="w-4 h-4 mr-2 opacity-80 flex-shrink-0" />
                Dashboard
              </Link>
              <Link
                href="/admin/forms"
                className="transition-colors hover:bg-highlight hover:text-primary text-foreground flex items-center px-4 py-2.5 rounded-xl font-medium text-sm border border-transparent hover:border-accent/40 whitespace-nowrap"
              >
                <FileStack className="w-4 h-4 mr-2 opacity-80 flex-shrink-0" />
                Formulir
              </Link>
            </nav>
          </div>

          <div className="flex items-center">
            <SignOutButton />
          </div>
        </div>
      </header>
      <main className="flex-1 p-4 md:p-8 lg:p-12 container mx-auto max-w-7xl w-full">
        {children}
      </main>
    </div>
  );
}