//
//  BSPatchModule.mm
//  expoupdatesclient
//
//  Created by Wallfacer on 15/10/25.
//

#import "BSPatchModule.h"
#import <React/RCTLog.h>
#import <React/RCTBridgeModule.h>
#ifdef __cplusplus
extern "C" {
#endif

#include <BSPatch/BSPatch.h>

#ifdef __cplusplus
}
#endif

@implementation BSPatchModule

RCT_EXPORT_MODULE(BSPatch);

/**
 * Helper: Get the current JS bundle file path
 */
- (NSString *)currentHermesBundlePath
{
  // Try to get the bundle path used by the current bridge
  NSString *bundlePath = [[NSBundle mainBundle] pathForResource:@"main" ofType:@"jsbundle"];
  
  if (!bundlePath) {
    RCTLogWarn(@"Could not find main.jsbundle in NSBundle. Returning nil path.");
  }
  
  return bundlePath;
}

/**
 * JS-callable method
 */
RCT_EXPORT_METHOD(applyPatch:(NSString *)patchFilePath
                  newFilePath:(NSString *)newFilePath
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *oldFilePath = [self currentHermesBundlePath];
  RCTLog(@"Check the oold bundle path: %@", oldFilePath);
  if (!oldFilePath) {
    reject(@"NO_BUNDLE_FOUND", @"Could not find Hermes bundle path.", nil);
    return;
  }
  
  NSFileManager *fileManager = [NSFileManager defaultManager];

  if (![fileManager fileExistsAtPath:newFilePath]) {
    BOOL success = [fileManager createFileAtPath:newFilePath contents:nil attributes:nil];
    
    if (success) {
      RCTLogInfo(@"✅ Created new file at %@", newFilePath);
    } else {
      RCTLogError(@"❌ Failed to create file at %@", newFilePath);
    }
  } else {
    RCTLogInfo(@"ℹ️ File already exists at %@", newFilePath);
  }

  NSString *inBuiltPatchPath = [[NSBundle mainBundle] pathForResource:@"react" ofType:@"patch"];
  

  const char *oldFile = [oldFilePath UTF8String];
  const char *newFile = [newFilePath UTF8String];
  const char *patchFile = [inBuiltPatchPath UTF8String];

  int res = bspatch(oldFile, newFile, patchFile);

  if (res == 0) {
    resolve(@"Patch applied successfully");
  } else {
    NSString *errorMsg = [NSString stringWithFormat:@"Error while patching file. Code: %d", res];
    RCTLogError(@"%@", errorMsg);
    reject(@"BSPATCH_ERROR", errorMsg, nil);
  }
}

@end
