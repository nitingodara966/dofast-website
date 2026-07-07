import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";
import { addWaitlistSignup } from "@/lib/db/waitlist";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});

const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

function clientIp(request: Request): string {
  // First hop of x-forwarded-for is set by the hosting platform (Vercel).
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

async function sendWelcomeEmail(email: string): Promise<boolean> {
  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error("waitlist: missing EMAILJS_* environment variables");
    return false;
  }

  try {
    const res = await fetch(EMAILJS_SEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        service_id: serviceId,
        template_id: templateId,
        user_id: publicKey,
        accessToken: privateKey,
        template_params: { email },
      }),
    });
    if (!res.ok) {
      console.error(
        `waitlist: EmailJS send failed with status ${res.status}: ${await res
          .text()
          .catch(() => "<unreadable body>")}`
      );
      return false;
    }
    return true;
  } catch (error) {
    console.error("waitlist: EmailJS request error", error);
    return false;
  }
}

export async function POST(request: Request) {
  const rate = checkRateLimit(`waitlist:${clientIp(request)}`, {
    limit: 5,
    windowMs: 60_000,
  });
  if (!rate.allowed) {
    return Response.json(
      { error: "Too many requests. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Please enter a valid email address." },
      { status: 400 }
    );
  }
  const { email } = parsed.data;

  // Persistence is the source of truth; the welcome email is best-effort.
  let created: boolean;
  try {
    ({ created } = await addWaitlistSignup(email, "landing_page"));
  } catch (error) {
    console.error("waitlist: database error", error);
    return Response.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
  }

  if (created) {
    console.log(`waitlist: signup ${email}`);
    const sent = await sendWelcomeEmail(email);
    if (!sent) {
      // Signup is recorded; a retry would be a duplicate and send nothing.
      console.error(`waitlist: welcome email not sent for ${email}`);
    }
  } else {
    console.log(`waitlist: duplicate signup ${email}`);
  }

  return Response.json({ ok: true });
}
