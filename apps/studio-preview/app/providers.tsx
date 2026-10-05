"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "next-themes";
import { useState } from "react";
import { Toaster } from "sonner";

export function Providers({children}:{children:React.ReactNode}) {
  const [client]=useState(()=>new QueryClient({
    defaultOptions:{queries:{retry:false,refetchOnWindowFocus:false}}
  }));
  return <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
    <QueryClientProvider client={client}>
      {children}
      <Toaster richColors position="bottom-right"/>
    </QueryClientProvider>
  </ThemeProvider>;
}
