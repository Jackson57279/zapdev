import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | ZapDev",
  description: "Privacy Policy for ZapDev AI development platform",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            ← Back to Home
          </Link>
        </div>

        <h1 className="text-4xl font-bold text-gray-900 mb-4">
          Privacy Policy
        </h1>
        <p className="text-gray-600 mb-8">
          Last updated: December 26, 2025
        </p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Introduction
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              At ZapDev, we take your privacy seriously. This Privacy Policy
              explains how we collect, use, disclose, and safeguard your
              information when you use our AI-powered development platform.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong className="text-gray-900">
                We will never sell or provide your data to third parties for
                marketing purposes.
              </strong>
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Information We Collect
            </h2>
            
            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              2.1 Personal Information
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              When you create an account, we collect:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Email address</li>
              <li>Name (if provided)</li>
              <li>Authentication credentials (managed securely through Clerk)</li>
              <li>Payment information (processed securely through third-party payment providers)</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              2.2 Usage Data
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We automatically collect certain information when you use ZapDev:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Project data and code you generate</li>
              <li>Conversation history with AI agents</li>
              <li>Usage metrics (number of projects, messages sent, etc.)</li>
              <li>Device information and browser type</li>
              <li>IP address and general location data</li>
              <li>Performance and error logs</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              2.3 Cookies and Tracking Technologies
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use cookies and similar tracking technologies to enhance your
              experience, maintain sessions, and analyze usage patterns.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. How We Use Your Information
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We use the information we collect to:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Provide and maintain the ZapDev service</li>
              <li>Process your requests and generate code through AI agents</li>
              <li>Manage your account and subscriptions</li>
              <li>Send service-related notifications and updates</li>
              <li>Improve and optimize our platform</li>
              <li>Detect and prevent fraud, abuse, and security issues</li>
              <li>Comply with legal obligations</li>
              <li>Analyze usage patterns to enhance user experience</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Data Sharing and Disclosure
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong className="text-gray-900">
                Your data is stored in our database and is only accessible by
                ZapDev. We do not sell, rent, or trade your personal information
                to third parties.
              </strong>
            </p>
            
            <p className="text-gray-700 leading-relaxed mb-4">
              We may share your information only in the following circumstances:
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              4.1 Service Providers
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We work with trusted third-party service providers who help us
              operate our platform. These include:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li><strong>Authentication:</strong> Clerk (for secure user authentication)</li>
              <li><strong>Database:</strong> Convex (for data storage)</li>
              <li><strong>Payments:</strong> Polar/Stripe (for payment processing)</li>
              <li><strong>Code Execution:</strong> E2B (for secure sandbox environments)</li>
              <li><strong>AI Services:</strong> OpenRouter/Anthropic (for AI model access)</li>
              <li><strong>Infrastructure:</strong> Vercel (for hosting)</li>
              <li><strong>Monitoring:</strong> Sentry (for error tracking)</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              These providers are contractually obligated to protect your data
              and use it only to provide services to us.
            </p>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              4.2 Legal Requirements
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may disclose your information if required by law or in response
              to valid legal processes, including:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Court orders or subpoenas</li>
              <li>Government or regulatory requests</li>
              <li>Compliance with legal obligations</li>
              <li>Protection of our rights, property, or safety</li>
              <li>Prevention of fraud or illegal activities</li>
            </ul>

            <h3 className="text-xl font-semibold text-gray-900 mb-3 mt-6">
              4.3 Business Transfers
            </h3>
            <p className="text-gray-700 leading-relaxed mb-4">
              In the event of a merger, acquisition, or sale of assets, your
              information may be transferred to the acquiring entity. We will
              notify you of any such change in ownership.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Data Security
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We implement industry-standard security measures to protect your
              data, including:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Encryption of data in transit and at rest</li>
              <li>Secure authentication and session management</li>
              <li>Regular security audits and monitoring</li>
              <li>Access controls and authentication requirements</li>
              <li>Isolated sandbox environments for code execution</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              However, no method of transmission over the internet is 100%
              secure. While we strive to protect your data, we cannot guarantee
              absolute security.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Data Retention
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We retain your personal information for as long as your account is
              active or as needed to provide you services. You may request
              deletion of your account and data at any time through your account
              settings.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              After account deletion, we may retain certain information for:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Legal compliance and record-keeping requirements</li>
              <li>Fraud prevention and security purposes</li>
              <li>Resolving disputes</li>
              <li>Enforcing our agreements</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Your Rights and Choices
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              You have the following rights regarding your personal data:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li><strong>Access:</strong> Request a copy of your personal data</li>
              <li><strong>Correction:</strong> Update or correct inaccurate information</li>
              <li><strong>Deletion:</strong> Request deletion of your account and data</li>
              <li><strong>Portability:</strong> Request your data in a portable format</li>
              <li><strong>Opt-out:</strong> Unsubscribe from marketing communications</li>
            </ul>
            <p className="text-gray-700 leading-relaxed mb-4">
              To exercise these rights, please contact us through your account
              settings or support channels.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Children&apos;s Privacy
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ZapDev is not intended for users under the age of 13. We do not
              knowingly collect personal information from children. If you
              believe we have collected information from a child, please contact
              us immediately.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. International Data Transfers
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your information may be transferred to and processed in countries
              other than your country of residence. These countries may have
              different data protection laws. By using ZapDev, you consent to
              the transfer of your information to these locations.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Changes to This Privacy Policy
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may update this Privacy Policy from time to time. We will
              notify you of any material changes by posting the new policy on
              this page and updating the &quot;Last updated&quot; date. We encourage you
              to review this policy periodically.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              11. Contact Us
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions or concerns about this Privacy Policy or
              our data practices, please contact us through our website or
              support channels.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Remember:</strong> We will never sell your data to third
              parties. Your data is only accessible by ZapDev and necessary
              service providers who help us operate the platform.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
