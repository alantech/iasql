import * as fs from 'fs'

// Lots of fun eventually planned for this: file names indicating whether the function is sync/async
// or whether it returns/throws, and response order if multiple with the same "method" are defined,
// but for now it's just what we need to mock the AWS gateway
export function ViciousMockery(mockDir: string) {
  const mockFiles = fs.readdirSync(mockDir).filter(f => /\.json$/.test(f));
  const mockNames = mockFiles.map(f => f.replace(/\.json$/, ''));
  const mockValues = mockFiles.map(f => JSON.parse(fs.readFileSync(`${mockDir}/${f}`, 'utf8')));
  const mockObj: any = {};
  mockNames.forEach((n, i) => {
    mockObj[n] = async () => mockValues[i];
  });
  return mockObj;
}
