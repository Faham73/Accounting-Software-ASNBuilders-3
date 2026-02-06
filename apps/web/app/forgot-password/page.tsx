import Link from 'next/link';

export default function ForgotPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-md">
        <div>
          <h1 className="text-2xl font-bold text-center text-gray-900">
            Forgot password?
          </h1>
        </div>
        <div className="mt-6">
          <p className="text-sm text-gray-600 text-center">
            Contact your administrator to reset your password.
          </p>
        </div>
        <div className="mt-6 text-center">
          <Link
            href="/login"
            className="text-sm text-blue-600 hover:text-blue-500 hover:underline"
          >
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
}
