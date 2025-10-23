import FormData from 'form-data';
import fs from 'fs/promises';
import { serializeDictionary } from 'structured-headers';
import { NextRequest, NextResponse } from 'next/server';

import {
  getAssetMetadataAsync,
  getMetadataAsync,
  convertSHA256HashToUUID,
  convertToDictionaryItemsRepresentation,
  signRSASHA256,
  getPrivateKeyAsync,
  getExpoConfigAsync,
  getLatestUpdateBundlePathForRuntimeVersionAsync,
  createRollBackDirectiveAsync,
  NoUpdateAvailableError,
  createNoUpdateAvailableDirectiveAsync,
} from '../../../common/helpers';
import { headers } from 'next/headers';
import { ReadonlyHeaders } from 'next/dist/server/web/spec-extension/adapters/headers';

export async function GET(req: NextRequest) {
  const headersList = await headers();
  const searchParams = req.nextUrl.searchParams;
  console.log('headers: ', Object.fromEntries(headersList.entries()));
  if (req.method !== 'GET') {
    console.log('Expected GET.');
    return NextResponse.json({ error: 'Expected GET.' }, { status: 405 });
  }

  const protocolVersionMaybeArray = headersList.get('expo-protocol-version');
  if (protocolVersionMaybeArray && Array.isArray(protocolVersionMaybeArray)) {
    console.log('Unsupported protocol version. Expected either 0 or 1.');
    return NextResponse.json(
      {
        error: 'Unsupported protocol version. Expected either 0 or 1.',
      },
      { status: 400 }
    );
  }
  const protocolVersion = parseInt(protocolVersionMaybeArray ?? '0', 10);

  const platform = headersList.get('expo-platform') ?? searchParams.get('platform');
  if (platform !== 'ios' && platform !== 'android') {
    console.log('Unsupported platform. Expected either ios or android.');
    return NextResponse.json(
      {
        error: 'Unsupported platform. Expected either ios or android.',
      },
      { status: 400 }
    );
  }

  const runtimeVersion =
    headersList.get('expo-runtime-version') ?? searchParams.get('runtime-version');
  console.log('runtimeVersion: ', runtimeVersion);
  if (!runtimeVersion || typeof runtimeVersion !== 'string') {
    console.log('No runtimeVersion provided.');
    return NextResponse.json(
      {
        error: 'No runtimeVersion provided.',
      },
      { status: 400 }
    );
  }

  let updateBundlePath: string;
  try {
    updateBundlePath = await getLatestUpdateBundlePathForRuntimeVersionAsync(runtimeVersion);
    console.log('updateBundlePath: ', updateBundlePath);
  } catch (error: any) {
    console.log('Error in getLatestUpdateBundlePathForRuntimeVersionAsync: ', error.message);
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 404 }
    );
  }

  const updateType = await getTypeOfUpdateAsync(updateBundlePath);

  try {
    try {
      console.log('Came till here: ', updateType);
      if (updateType === UpdateType.NORMAL_UPDATE) {
        return await putUpdateInResponseAsync(
          headersList,
          updateBundlePath,
          runtimeVersion,
          platform,
          protocolVersion
        );
      } else if (updateType === UpdateType.ROLLBACK) {
        return await putRollBackInResponseAsync(headersList, updateBundlePath, protocolVersion);
      }
    } catch (maybeNoUpdateAvailableError) {
      //console.log('Error in maybeNoUpdateAvailableError upside: ', maybeNoUpdateAvailableError);
      if (maybeNoUpdateAvailableError instanceof NoUpdateAvailableError) {
        return await putNoUpdateAvailableInResponseAsync(headersList, protocolVersion);
      }
      throw maybeNoUpdateAvailableError;
    }
  } catch (error) {
    console.error('Error in maybeNoUpdateAvailableError:', error);
    return NextResponse.json({ error }, { status: 404 });
  }
}

enum UpdateType {
  NORMAL_UPDATE,
  ROLLBACK,
}

async function getTypeOfUpdateAsync(updateBundlePath: string): Promise<UpdateType> {
  const directoryContents = await fs.readdir(updateBundlePath);
  console.log('directoryContents: ', directoryContents);
  return directoryContents.includes('rollback') ? UpdateType.ROLLBACK : UpdateType.NORMAL_UPDATE;
}

async function putUpdateInResponseAsync(
  headersList: ReadonlyHeaders,
  updateBundlePath: string,
  runtimeVersion: string,
  platform: string,
  protocolVersion: number
): Promise<Response> {
  const currentUpdateId = headersList.get('expo-current-update-id');
  const { metadataJson, createdAt, id } = await getMetadataAsync({
    updateBundlePath,
    runtimeVersion,
  });

  // NoUpdateAvailable directive only supported on protocol version 1
  // for protocol version 0, serve most recent update as normal
  if (currentUpdateId === convertSHA256HashToUUID(id) && protocolVersion === 1) {
    throw new NoUpdateAvailableError();
  }

  const expoConfig = await getExpoConfigAsync({
    updateBundlePath,
    runtimeVersion,
  });
  const platformSpecificMetadata = metadataJson.fileMetadata[platform];
  const manifest = {
    id: convertSHA256HashToUUID(id),
    createdAt,
    runtimeVersion,
    assets: await Promise.all(
      (platformSpecificMetadata.assets as any[]).map((asset: any) =>
        getAssetMetadataAsync({
          updateBundlePath,
          filePath: asset.path,
          ext: asset.ext,
          runtimeVersion,
          platform,
          isLaunchAsset: false,
        })
      )
    ),
    launchAsset: await getAssetMetadataAsync({
      updateBundlePath,
      filePath: platformSpecificMetadata.bundle,
      isLaunchAsset: true,
      runtimeVersion,
      platform,
      ext: null,
    }),
    metadata: {},
    extra: {
      expoClient: expoConfig,
    },
  };

  let signature = null;
  const expectSignatureHeader = headersList.get('expo-expect-signature');
  if (expectSignatureHeader) {
    const privateKey = await getPrivateKeyAsync();
    if (!privateKey) {
      console.log('Code signing requested but no key supplied when starting server.');
      return NextResponse.json(
        {
          error: 'Code signing requested but no key supplied when starting server.',
        },
        { status: 400 }
      );
    }
    const manifestString = JSON.stringify(manifest);
    const hashSignature = signRSASHA256(manifestString, privateKey);
    const dictionary = convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: 'main',
    });
    console.log('dictionary: ', dictionary);
    signature = serializeDictionary(dictionary);
  }

  const assetRequestHeaders: { [key: string]: object } = {};
  [...manifest.assets, manifest.launchAsset].forEach((asset) => {
    assetRequestHeaders[asset.key] = {
      'test-header': 'test-header-value',
    };
  });

  const form = new FormData();
  form.append('manifest', JSON.stringify(manifest), {
    contentType: 'application/json',
    header: {
      'content-type': 'application/json; charset=utf-8',
      ...(signature ? { 'expo-signature': signature } : {}),
    },
  });
  form.append('extensions', JSON.stringify({ assetRequestHeaders }), {
    contentType: 'application/json',
  });

  const headers = {
    'expo-protocol-version': protocolVersion.toString(),
    'expo-sfv-version': '0',
    'cache-control': 'private, max-age=0',
    'content-type': `multipart/mixed; boundary=${form.getBoundary()}`,
  };
  const buffer = form.getBuffer();
  return new NextResponse(buffer, { status: 200, headers });
}

async function putRollBackInResponseAsync(
  headersList: ReadonlyHeaders,
  updateBundlePath: string,
  protocolVersion: number
): Promise<Response> {
  if (protocolVersion === 0) {
    throw new Error('Rollbacks not supported on protocol version 0');
  }

  const embeddedUpdateId = headersList.get('expo-embedded-update-id');
  if (!embeddedUpdateId || typeof embeddedUpdateId !== 'string') {
    throw new Error('Invalid Expo-Embedded-Update-ID request header specified.');
  }

  const currentUpdateId = headersList.get('expo-current-update-id');
  if (currentUpdateId === embeddedUpdateId) {
    throw new NoUpdateAvailableError();
  }

  const directive = await createRollBackDirectiveAsync(updateBundlePath);

  let signature = null;
  const expectSignatureHeader = headersList.get('expo-expect-signature');
  if (expectSignatureHeader) {
    const privateKey = await getPrivateKeyAsync();
    if (!privateKey) {
      console.log('Code signing requested but no key supplied when starting server.');
      return NextResponse.json(
        {
          error: 'Code signing requested but no key supplied when starting server.',
        },
        { status: 400 }
      );
    }
    const directiveString = JSON.stringify(directive);
    const hashSignature = signRSASHA256(directiveString, privateKey);
    const dictionary = convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: 'main',
    });
    signature = serializeDictionary(dictionary);
  }

  const form = new FormData();
  form.append('directive', JSON.stringify(directive), {
    contentType: 'application/json',
    header: {
      'content-type': 'application/json; charset=utf-8',
      ...(signature ? { 'expo-signature': signature } : {}),
    },
  });

  const headers = {
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
    'cache-control': 'private, max-age=0',
    'content-type': `multipart/mixed; boundary=${form.getBoundary()}`,
  };
  const buffer = form.getBuffer();
  return new NextResponse(buffer, { status: 200, headers });
}

async function putNoUpdateAvailableInResponseAsync(
  headersList: ReadonlyHeaders,
  protocolVersion: number
): Promise<Response> {
  if (protocolVersion === 0) {
    throw new Error('NoUpdateAvailable directive not available in protocol version 0');
  }

  const directive = await createNoUpdateAvailableDirectiveAsync();

  let signature = null;
  const expectSignatureHeader = headersList.get('expo-expect-signature');
  if (expectSignatureHeader) {
    const privateKey = await getPrivateKeyAsync();
    if (!privateKey) {
      console.log(
        'putNoUpdateAvailableInResponseAsync: Code signing requested but no key supplied when starting server.'
      );

      return NextResponse.json(
        {
          error: 'Code signing requested but no key supplied when starting server.',
        },
        { status: 400 }
      );
    }
    const directiveString = JSON.stringify(directive);
    const hashSignature = signRSASHA256(directiveString, privateKey);
    const dictionary = convertToDictionaryItemsRepresentation({
      sig: hashSignature,
      keyid: 'main',
    });
    signature = serializeDictionary(dictionary);
  }

  const form = new FormData();
  form.append('directive', JSON.stringify(directive), {
    contentType: 'application/json',
    header: {
      'content-type': 'application/json; charset=utf-8',
      ...(signature ? { 'expo-signature': signature } : {}),
    },
  });

  const headers = {
    'expo-protocol-version': '1',
    'expo-sfv-version': '0',
    'cache-control': 'private, max-age=0',
    'content-type': `multipart/mixed; boundary=${form.getBoundary()}`,
  };
  const buffer = form.getBuffer();
  return new NextResponse(buffer, { status: 200, headers });
}
