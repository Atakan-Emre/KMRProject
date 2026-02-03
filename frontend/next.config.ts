import type { NextConfig } from "next";

// GitHub Pages için dinamik basePath ayarı
// Eğer repo adı username.github.io formatındaysa basePath boş olmalı
// Aksi halde /repo-name formatında olmalı
const getBasePath = () => {
  // Development modunda basePath boş
  if (process.env.NODE_ENV !== "production") {
    return "";
  }

  // GitHub Actions'tan gelen repository bilgisi
  // GITHUB_REPOSITORY yoksa (lokal build) basePath boş olsun
  const githubRepo = process.env.GITHUB_REPOSITORY;
  if (!githubRepo) {
    return "";
  }
  
  const repoName = githubRepo.split("/")[1];
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
  // GitHub Pages için optimize edilmiş ayarlar
  distDir: "out",
  // Static export için gerekli
  reactStrictMode: true,
  // Client-side'da basePath'e erişim için environment variable
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
