import { StatusBar } from "expo-status-bar";
import { NativeModules, StyleSheet, Text, View, Image } from "react-native";
import Constants from "expo-constants";
import ButtonView, {
  ButtonViewType,
} from "@airasia-phoenix/react-native/components/ButtonView";
import SpinnerLoaderView from "@airasia-phoenix/react-native/components/SpinnerLoaderView";
import { getColor, pd } from "@airasia-phoenix/react-native/utils";
import * as Updates from "expo-updates";
import { useEffect } from "react";
import TextView from "@airasia-phoenix/react-native/components/TextView";
import * as FileSystem from "expo-file-system";
import { SpinnerLoaderViewStyle } from "@airasia-phoenix/react-native/components/SpinnerLoaderView/types";

const App = () => {
  const { downloadProgress, isChecking, isDownloading, isUpdateAvailable } =
    Updates.useUpdates();
  async function checkForUpdates() {
    try {
      await Updates.checkForUpdateAsync();
    } catch (error) {
      // You can also add an alert() to see the error message in case of an error when fetching updates.
      console.log(`Error fetching Expo update: ${error}`);
      alert(`Error fetching Expo update: ${error}`);
    }
  }

  async function downloadUpdate() {
    try {
      await Updates.fetchUpdateAsync();
      await Updates.reloadAsync();
      alert("Updated successfully");
    } catch (error) {
      console.log("Error in applying update: ", error);
      alert("Updated failed");
    }
  }

  useEffect(() => {
    checkForUpdates();
  }, []);

  console.log("See downloadProgress: ", downloadProgress);

  const { BSPatch } = NativeModules;

  async function updateBundle() {
    console.log("BSPatch: ", BSPatch.applyPatch);
    try {
      const newFilePath = FileSystem.bundleDirectory + "new.jsbundle";
      const result = await BSPatch.applyPatch("", newFilePath);
      console.log("✅", result);
      alert("✅" + result);
    } catch (err) {
      console.error("❌ Patch failed:", err);
      alert("❌ Patch failed:" + err);
    }
  }

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: getColor(pd.sys.colour.container_low) },
      ]}
    >
      <Text>Hey there, this is wokring! Progress working..!</Text>
      <Text>{Constants.expoConfig.name}</Text>
      <Image source={require("./assets/favicon.png")} />
      <StatusBar style="auto" />
      <View style={{ marginVertical: 16 }}>
        <ButtonView
          disabled={false}
          type={ButtonViewType.PRIMARY_REGULAR}
          onPress={() => {
            alert("Yayyy..! BSDiff testing");
          }}
          text="Press me to alert"
        />
        <ButtonView
          disabled={false}
          type={ButtonViewType.SECONDARY_REGULAR}
          onPress={() => {
            updateBundle();
          }}
          text="Press me to patch bundle"
        />
      </View>
      {isUpdateAvailable ? (
        <View style={{ marginVertical: 16 }}>
          <TextView text="There is an update available!" />
          <ButtonView
            disabled={false}
            type={ButtonViewType.PRIMARY_REGULAR}
            onPress={() => {
              downloadUpdate();
            }}
            text="Press to Update"
          />
        </View>
      ) : (
        <TextView
          text={isChecking ? "Checking for updates!" : "No updates available!"}
        />
      )}
      {!isChecking || !isDownloading ? (
        <ButtonView
          disabled={false}
          type={ButtonViewType.SECONDARY_SMALL}
          onPress={() => {
            checkForUpdates();
          }}
          text="Press to check for updates"
        />
      ) : null}
      {isDownloading ? (
        <SpinnerLoaderView
          spinnerStyle={SpinnerLoaderViewStyle.PROGRESS}
          progressValue={downloadProgress}
          showProgressValueText
        />
      ) : null}
      <ButtonView
        disabled={false}
        type={ButtonViewType.SECONDARY_SMALL}
        onPress={() => {
          Updates.reloadAsync({
            reloadScreenOptions: {
              backgroundColor: "#f00",
              image: {
                height: 1000,
                width: 1000,
                url: require("./assets/icon.png"),
              },
            },
          });
        }}
        text="Press to reload JS"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default App;
