const fs = require('fs');
const path = require('path');

const gradlePath = path.resolve(__dirname, '../node_modules/capacitor-native-biometric/android/build.gradle');

if (fs.existsSync(gradlePath)) {
    let content = fs.readFileSync(gradlePath, 'utf8');
    let patched = false;

    if (content.includes('jcenter()')) {
        content = content.replace(/jcenter\(\)/g, 'mavenCentral()');
        patched = true;
    }

    if (content.includes("proguard-android.txt")) {
        content = content.replace(/proguard-android\.txt/g, 'proguard-android-optimize.txt');
        patched = true;
    }

    if (patched) {
        fs.writeFileSync(gradlePath, content, 'utf8');
        console.log('Successfully patched capacitor-native-biometric/android/build.gradle');
    } else {
        console.log('capacitor-native-biometric/android/build.gradle is already patched.');
    }
} else {
    console.warn('Could not find capacitor-native-biometric/android/build.gradle. It may not be installed.');
}
