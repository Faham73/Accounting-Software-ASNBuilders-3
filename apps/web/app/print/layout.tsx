import { PRINT_CSS } from '@/lib/print/css';

export const metadata = {
  title: 'Print Document',
};

export default function PrintLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />
      {children}
    </>
  );
}
