export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="max-w-mobile mx-auto min-h-dvh">
      {children}
    </div>
  )
}
