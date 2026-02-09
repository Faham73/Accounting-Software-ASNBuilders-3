'use client';

import { useState, useEffect, FormEvent, Suspense, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  // If bootstrap not yet done, redirect to setup
  // Optimized: Only run once on mount to prevent blocking UI updates
  useEffect(() => {
    let mounted = true;
    const abortController = new AbortController();
    
    // Defer the check to avoid blocking initial render
    const timeoutId = setTimeout(() => {
      if (!mounted) return;
      
      fetch('/api/auth/bootstrap', { signal: abortController.signal })
        .then((res) => res.json())
        .then((data) => {
          if (!mounted) return;
          if (data.ok && data.data?.allowed === true) {
            const redirect = searchParams.get('redirect');
            router.replace(redirect ? `/setup?redirect=${encodeURIComponent(redirect)}` : '/setup');
          }
        })
        .catch((err) => {
          // Ignore abort errors and network errors
          if (err.name !== 'AbortError' && mounted) {
            console.error('Bootstrap check failed:', err);
          }
        });
    }, 0);
    
    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      abortController.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount - searchParams accessed inside callback

  // Memoize handlers to prevent unnecessary re-renders
  const handleEmailChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  }, []);

  const handlePasswordChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setPassword(e.target.value);
  }, []);

  const handleSubmit = useCallback(async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok || !data.ok) {
        setError(data.error || 'Login failed');
        setIsLoading(false);
        return;
      }

      // Redirect to dashboard (or the redirect param from middleware)
      const redirect = searchParams.get('redirect') || '/dashboard';
      router.push(redirect);
    } catch (err) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  }, [email, password, router, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Sign in to your account
          </h1>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={handleEmailChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="you@example.com"
                disabled={isLoading}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={handlePasswordChange}
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                placeholder="Enter your password"
                disabled={isLoading}
              />
            </div>
            <div className="flex items-center justify-end">
              <Link
                href="/forgot-password"
                className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          {error && (
            <div className="rounded-md bg-red-50 p-4">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {isLoading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-600">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
