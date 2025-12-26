import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | ZapDev",
  description: "Terms of Service for ZapDev AI development platform",
};

export default function TermsOfServicePage() {
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
          Terms of Service
        </h1>
        <p className="text-gray-600 mb-8">
          Last updated: December 26, 2025
        </p>

        <div className="prose prose-gray max-w-none">
          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              1. Acceptance of Terms
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              By accessing and using ZapDev (&quot;the Service&quot;), you accept and agree to be
              bound by the terms and provision of this agreement. If you do not
              agree to abide by the above, please do not use this service.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              2. Use of Service
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ZapDev is an AI-powered development platform that allows you to
              create web applications through conversational interactions with
              AI agents. You agree to use the Service only for lawful purposes
              and in accordance with these Terms.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>You agree NOT to use the Service to:</strong>
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Create, distribute, or facilitate illegal content or activities</li>
              <li>Develop malware, viruses, or any malicious software</li>
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on intellectual property rights of others</li>
              <li>Generate content that promotes harm, violence, or discrimination</li>
              <li>Attempt to circumvent usage limits or security measures</li>
              <li>Engage in automated scraping or data harvesting</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              3. User Accounts and Subscriptions
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              To access certain features of the Service, you may be required to
              create an account. You are responsible for maintaining the
              confidentiality of your account credentials and for all activities
              that occur under your account.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              We offer both free and paid subscription tiers. Usage limits apply
              based on your subscription level. You may cancel your subscription
              at any time through your account settings.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              4. Intellectual Property
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Code You Generate:</strong> You retain all rights to the
              code and applications you create using ZapDev. We do not claim
              ownership of your generated content.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Our Platform:</strong> The ZapDev platform, including its
              design, functionality, and underlying technology, is owned by
              ZapDev and protected by intellectual property laws.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              5. Data and Privacy
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              Your use of ZapDev is also governed by our{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Privacy Policy
              </Link>
              . We are committed to protecting your privacy and will never sell
              your data to third parties for marketing purposes.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              <strong>Important:</strong> We may only share your data with third
              parties when:
            </p>
            <ul className="list-disc pl-6 mb-4 space-y-2 text-gray-700">
              <li>Required by law or valid legal process (e.g., court order, subpoena)</li>
              <li>Necessary to provide the Service (e.g., hosting providers, payment processors)</li>
              <li>You have given explicit consent</li>
            </ul>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              6. Service Availability and Modifications
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We strive to provide reliable service, but we do not guarantee
              uninterrupted access. We reserve the right to modify, suspend, or
              discontinue any part of the Service at any time with or without
              notice.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              7. Limitation of Liability
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              ZapDev is provided &quot;as is&quot; without warranties of any kind. We are
              not liable for any damages arising from your use of the Service,
              including but not limited to direct, indirect, incidental, or
              consequential damages.
            </p>
            <p className="text-gray-700 leading-relaxed mb-4">
              You are responsible for reviewing and testing all code generated
              by the AI before deploying it to production environments.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              8. Termination
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We may terminate or suspend your account and access to the Service
              immediately, without prior notice or liability, for any reason,
              including if you breach these Terms. Upon termination, your right
              to use the Service will immediately cease.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              9. Changes to Terms
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              We reserve the right to modify these Terms at any time. We will
              notify you of any changes by posting the new Terms on this page
              and updating the &quot;Last updated&quot; date. Your continued use of the
              Service after such modifications constitutes your acceptance of
              the updated Terms.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              10. Governing Law
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              These Terms shall be governed by and construed in accordance with
              the laws of the United States, without regard to its conflict of
              law provisions.
            </p>
          </section>

          <section className="mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              11. Contact Us
            </h2>
            <p className="text-gray-700 leading-relaxed mb-4">
              If you have any questions about these Terms, please contact us
              through our website or support channels.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
