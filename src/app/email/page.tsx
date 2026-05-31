"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { auth } from "@/config/firebase";
import { MailProvider } from "@/context/MailContext";
import MailLayout from "@/components/mail/MailLayout";

function EmailPageContent() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((user) => {
      if (!user) {
        router.push("/login");
      } else {
        setChecking(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <MailProvider>
      <MailLayout />
    </MailProvider>
  );
}

export default function EmailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          Chargement...
        </div>
      }
    >
      <EmailPageContent />
    </Suspense>
  );
}
