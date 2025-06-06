import { Metadata, ResolvingMetadata } from "next";
import { redirect } from "next/navigation";
import React from "react";

export const generateMetadata = async (): Promise<Metadata> => {
  return {
    title: "새로운 글 쓰기 - 자유 게시판 :: 디풀",
  };
};

const Layout = ({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) => {
  return children;
};

export default Layout;