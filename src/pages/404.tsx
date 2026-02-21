/* eslint-disable @next/next/no-html-link-for-pages */

export default function Custom404() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, sans-serif',
      padding: '20px',
      textAlign: 'center'
    }}>
      <h1 style={{ fontSize: '72px', marginBottom: '16px' }}>404</h1>
      <h2 style={{ fontSize: '24px', marginBottom: '16px' }}>Page Not Found</h2>
      <p style={{ color: '#666', marginBottom: '24px' }}>
        The page you are looking for does not exist.
      </p>
      <a
        href="/"
        style={{
          padding: '10px 20px',
          background: '#C96342',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '6px',
          fontSize: '16px'
        }}
      >
        Go Home
      </a>
    </div>
  );
}

