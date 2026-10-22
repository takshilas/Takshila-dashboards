/** @type {import('next').NextConfig} */
module.exports = {
  poweredByHeader: false,
  // The dashboard files are read from disk by route handlers; make sure they ship with the serverless functions.
  experimental: {
    outputFileTracingIncludes: {
      '/': ['./private/**/*'],
      '/assets/[file]': ['./private/**/*']
    }
  }
};
