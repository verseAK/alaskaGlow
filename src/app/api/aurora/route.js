import { fetchAuroraData } from '@/lib/data';

export const revalidate = 300; // Revalidate every 5 minutes

export async function GET() {
  try {
    const data = await fetchAuroraData();
    return Response.json(data, {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=300',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (err) {
    console.error('Aurora API error:', err);
    return Response.json(
      { error: 'Failed to fetch aurora data', message: err.message },
      { status: 500 }
    );
  }
}
