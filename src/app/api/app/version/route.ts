export async function GET() {
  return Response.json({
    success: true,
    data: {
      minVersionCode: parseInt(process.env.GATE_APP_MIN_VERSION_CODE ?? '1', 10),
      downloadUrl: process.env.NEXT_PUBLIC_GATE_APP_URL ?? null,
    },
  })
}
