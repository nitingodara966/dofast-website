import { z } from "zod";
import { checkRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
});

const EMAILJS_SEND_URL = "https://api.emailjs.com/api/v1.0/email/send";

function clientIp(request: Request): string {
  // First hop of x-forwarded-for is set by the hosting platform (Vercel).
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
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

  const serviceId = process.env.EMAILJS_SERVICE_ID;
  const templateId = process.env.EMAILJS_TEMPLATE_ID;
  const publicKey = process.env.EMAILJS_PUBLIC_KEY;
  const privateKey = process.env.EMAILJS_PRIVATE_KEY;
  if (!serviceId || !templateId || !publicKey || !privateKey) {
    console.error("waitlist: missing EMAILJS_* environment variables");
    return Response.json(
      { error: "Something went wrong. Please try again later." },
      { status: 500 }
    );
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
      return Response.json(
        { error: "Something went wrong. Please try again later." },
        { status: 502 }
      );
    }
  } catch (error) {
    console.error("waitlist: EmailJS request error", error);
    return Response.json(
      { error: "Something went wrong. Please try again later." },
      { status: 502 }
    );
  }

  console.log(`waitlist: signup ${email}`);
  return Response.json({ ok: true });
}
