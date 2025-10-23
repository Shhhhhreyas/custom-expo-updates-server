import fs from 'fs';
import fsPromises from 'fs/promises';
import mime from 'mime';
import nullthrows from 'nullthrows';
import path from 'path';

import {
  getLatestUpdateBundlePathForRuntimeVersionAsync,
  getMetadataAsync,
} from '../../../common/helpers';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const assetName = searchParams.get('asset');
  const runtimeVersion = searchParams.get('runtimeVersion');
  const platform = searchParams.get('platform');

  if (!assetName || typeof assetName !== 'string') {
    NextResponse.json({ error: 'No asset name provided.' }, { status: 400 });
    return;
  }

  if (platform !== 'ios' && platform !== 'android') {
    NextResponse.json(
      { error: 'No platform provided. Expected "ios" or "android".' },
      { status: 400 }
    );
    return;
  }

  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    NextResponse.json({ error: 'No runtimeVersion provided.' }, { status: 400 });
    return;
  }

  let updateBundlePath: string;
  try {
    updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
  } catch (error: any) {
    NextResponse.json(
      {
        error: error.message,
      },
      { status: 404 }
    );
    return;
  }

  const { metadataJson } = await getMetadataAsync({
    updateBundlePath,
    runtimeVersion,
  });

  const assetPath = path.resolve(assetName);
  const assetMetadata = metadataJson.fileMetadata[platform].assets.find(
    (asset: any) => asset.path === assetName.replace(`${updateBundlePath}/`, '')
  );
  const isLaunchAsset =
    metadataJson.fileMetadata[platform].bundle === assetName.replace(`${updateBundlePath}/`, '');

  if (!fs.existsSync(assetPath)) {
    NextResponse.json({ error: `Asset "${assetName}" does not exist.` }, { status: 404 });
    return;
  }

  try {
    const asset = await fsPromises.readFile(assetPath, null);
    return new Response(asset, {
      headers: {
        'content-type': isLaunchAsset
          ? 'application/javascript'
          : nullthrows(mime.getType(assetMetadata.ext)),
        'Content-Length': asset.length.toString(),
      },
      status: 200,
    });
  } catch (error) {
    console.log(error);
    NextResponse.json({ error }, { status: 500 });
  }
}
