import { Background, Logo } from "@dub/ui";
import { constructMetadata } from "@dub/utils";
import prisma from "@/lib/prisma";
import PasswordForm from "./form";
import { notFound, redirect } from "next/navigation";

const title = "Password Required";
const description =
  "This link is password protected. Please enter the password to view it.";
const image = "https://dub.co/_static/password-protected.png";

export async function generateMetadata({
  params,
}: {
  params: { domain: string; key: string };
}) {
  const domain = params.domain;
  const key = decodeURIComponent(params.key);

  const link = await prisma.link.findUnique({
    where: {
      domain_key: {
        domain,
        key,
      },
    },
    select: {
      project: {
        select: {
          logo: true,
          plan: true,
        },
      },
    },
  });

  if (!link) {
    notFound();
  }

  return constructMetadata({
    title,
    description,
    image,
    ...(domain !== "dub.sh" &&
      link.project?.plan !== "free" &&
      link.project?.logo && {
        icons: link.project.logo,
      }),
    noIndex: true,
  });
}

export async function generateStaticParams() {
  const passwordProtectedLinks = await prisma.link.findMany({
    where: {
      password: {
        not: null,
      },
    },
    select: {
      domain: true,
      key: true,
    },
  });

  return passwordProtectedLinks.map(({ domain, key }) => ({
    params: {
      domain,
      key: encodeURIComponent(key),
    },
  }));
}

export default async function PasswordProtectedLinkPage({
  params,
}: {
  params: { domain: string; key: string };
}) {
  const domain = params.domain;
  const key = decodeURIComponent(params.key);

  const link = await prisma.link.findUnique({
    where: {
      domain_key: {
        domain,
        key,
      },
    },
    select: {
      password: true,
      url: true,
      project: {
        select: {
          name: true,
          logo: true,
          plan: true,
        },
      },
    },
  });

  if (!link) {
    notFound();
  }

  if (!link.password) {
    redirect(link.url);
  }

  return (
    <main className="flex h-screen w-screen items-center justify-center">
      <Background />
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-gray-100 shadow-xl">
        <div className="flex flex-col items-center justify-center space-y-3 border-b border-gray-200 bg-white px-4 py-6 pt-8 text-center sm:px-16">
          {domain !== "dub.sh" &&
          link.project?.plan !== "free" &&
          link.project?.logo ? (
            <img
              src={link.project.logo}
              alt={link.project.name}
              className="h-10 w-10 rounded-full"
            />
          ) : (
            <a href="https://dub.co" target="_blank" rel="noreferrer">
              <Logo />
            </a>
          )}
          <h3 className="text-xl font-semibold">{title}</h3>
          <p className="text-sm text-gray-500">{description}</p>
        </div>
        <PasswordForm />
      </div>
    </main>
  );
}
