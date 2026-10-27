export const dynamic = 'force-dynamic';

export default function Login({ searchParams }) {
  const error = searchParams && searchParams.e;
  const field = { display: 'block', width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #E7E2EC', borderRadius: 8, font: 'inherit', marginTop: 4 };
  return (
    <main style={{ maxWidth: 400, margin: '0 auto', padding: '72px 16px' }}>
      <div style={{ color: '#C231FF', fontWeight: 700, fontSize: 12, letterSpacing: '.06em', textTransform: 'uppercase', marginBottom: 6 }}>CommerceIQ · Market intelligence</div>
      <h1 style={{ color: '#210235', fontSize: 26, margin: '0 0 6px' }}>Britax US pricing and share</h1>
      <p style={{ color: '#5b5266', margin: '0 0 20px' }}>Enter the password you were given and your work email.</p>
      <form method="post" action="/api/login">
        <label style={{ display: 'block', marginBottom: 12 }}>Work email
          <input name="email" type="email" required autoComplete="email" style={field} />
        </label>
        <label style={{ display: 'block', marginBottom: 12 }}>Password
          <input name="password" type="password" required autoComplete="current-password" style={field} />
        </label>
        {error ? <p role="alert" style={{ color: '#B42318', margin: '0 0 12px' }}>{error === 'email' ? 'Enter a valid email address.' : 'That password did not match.'}</p> : null}
        <button type="submit" style={{ background: '#210235', color: '#fff', border: 0, borderRadius: 8, padding: '10px 16px', font: 'inherit', cursor: 'pointer' }}>Open dashboard</button>
      </form>
    </main>
  );
}
