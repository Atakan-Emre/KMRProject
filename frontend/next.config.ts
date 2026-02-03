import type { NextConfig } from "next";

// GitHub Pages için dinamik basePath ayarı
// Eğer repo adı username.github.io formatındaysa basePath boş olmalı
// Aksi halde /repo-name formatında olmalı
const getBasePath = () => {
  if (process.env.NODE_ENV !== "production") {
    return "";
  }

  const repoName = process.env.GITHUB_REPOSITORY?.split("/")[1] || "KMRProject";
  const githubPagesPattern = /^[\w-]+\.github\.io$/;
  
  // Eğer repo adı username.github.io formatındaysa basePath boş
  if (githubPagesPattern.test(repoName)) {
    return "";
  }
  
  // Aksi halde /repo-name
  return `/${repoName}`;
};

const basePath = getBasePath();

const nextConfig: NextConfig = {
  output: "export",
  basePath: basePath,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
