import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View, Image } from "react-native";
import Constants from "expo-constants";
import ButtonView, {
  ButtonViewType,
} from "@airasia-phoenix/react-native/components/ButtonView";
import { getColor, pd } from "@airasia-phoenix/react-native/utils";
import * as Updates from "expo-updates";
import { useEffect, useState } from "react";
import TextView from "@airasia-phoenix/react-native/components/TextView";

const App = () => {
  const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
  console.log("first: ", Updates.checkAutomatically);
  async function checkForUpdates() {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        setIsUpdateAvailable(true);
      } else {
        setIsUpdateAvailable(false);
      }
    } catch (error) {
      setIsUpdateAvailable(false);
      // You can also add an alert() to see the error message in case of an error when fetching updates.
      alert(`Error fetching latest Expo update: ${error}`);
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
    } finally {
      setIsUpdateAvailable(false);
    }
  }

  useEffect(() => {
    checkForUpdates();
  }, []);
  return (
    <View
      style={[
        styles.container,
        { backgroundColor: getColor(pd.sys.colour.secondary_low) },
      ]}
    >
      <Text>Hey there, this is wokring! Changing this</Text>
      <Text>{Constants.expoConfig.name}</Text>
      <Image source={require("./assets/favicon.png")} />
      <StatusBar style="auto" />
      <View style={{ marginVertical: 16 }}>
        <ButtonView
          disabled={false}
          type={ButtonViewType.PRIMARY_REGULAR}
          onPress={() => {
            alert("Yayy..! Instantly working");
          }}
          text="Press me to alert"
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
        <TextView text="No updates available!" />
      )}
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
