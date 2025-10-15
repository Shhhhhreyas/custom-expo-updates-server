const path = require('path');
const bsdiff = require('bsdiff-node');

const oldFile = path.join(
  __dirname,
  '../updates/2/1760473267/assets/4f1cb2cac2370cd5050681232e8575a8'
);
const newFile = path.join(
  __dirname,
  '../updates/2/1760473410/assets/4f1cb2cac2370cd5050681232e8575a8'
);
const patchFile = path.join(__dirname, '../updates/react.patch');
const generatedFile = path.join(__dirname, '../updates/react-generated.zip');

async function asyncCall() {
  await bsdiff.diff(oldFile, newFile, patchFile, function (result) {
    console.log('diff:' + String(result).padStart(4) + '%');
  });

  await bsdiff.patch(oldFile, generatedFile, patchFile, function (result) {
    console.log('patch:' + String(result).padStart(4) + '%');
  });
}

asyncCall();
