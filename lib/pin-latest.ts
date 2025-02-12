import { join } from 'path';
import { dirExists, fileExists } from './utils';
import pj from 'package-json';
import { promises as fs } from 'fs';

export const PACKAGE_JSON = 'package.json';
export const LATEST = 'latest';

const util = require('util');
const exec = util.promisify(require('child_process').exec);

export interface PinLatestProps {
    targetDirectory: string;
    exact: boolean;
    debug: boolean;
    write: boolean;
}

type GenericObject = {
    [key: string]: string;
};

export interface PackageJson {
    dependencies?: GenericObject;
    devDependencies?: GenericObject;
    peerDependencies?: GenericObject;
    buildDependencies?: GenericObject;
    optionalDependencies?: GenericObject;
}

const processDependencyBlock = async (
    key: string,
    packageJson: any,
    exact: boolean,
    debug: boolean
) => {
    if (debug) {
        console.log(`Processing: ${key}`);
    }

    const currentDepBlock: GenericObject = packageJson[key];

    for (const packageName in currentDepBlock) {
        ////const currentPackage: string = currentDepBlock[packageName];
        try {
            const { stdout, stderr } = await exec('node -p "require(\'' + packageName + '/package.json\').version"');

            if(!stderr) {
                const currentPackage: string = stdout.trim();
                console.log('[' + packageName, '] version is: ', currentPackage);
                //console.log(packageName, currentPackage);

                //if (currentPackage === LATEST) {
                    if (debug) {
                        console.log(`Pinning: ${key}/${packageName}`);
                    }

                    try {
                        //const { version } = await pj(packageName);
                        //const versionToWrite = exact ? version : `^${version}`;
                        const version = currentPackage;
                        const versionToWrite = exact ? version : `^${version}`;

                        packageJson[key][packageName] = versionToWrite;
                    } catch {
                        console.error(
                            `Failed to fetch package info for: ${packageName}`
                        );
                        continue;
                    }
                //}
            } else {
                console.log(stderr);
            }
        } catch(e) {

        }
    }

    return packageJson;
};

const PinLatest = async ({
    targetDirectory,
    exact,
    debug,
    write,
}: PinLatestProps): Promise<void> => {
    const { stats } = await dirExists(targetDirectory);

    if (!stats) {
        throw new Error(`${targetDirectory} does not exist`);
    }

    if (!stats.isDirectory()) {
        throw new Error(`${targetDirectory} is not a directory`);
    }

    const packageJsonFile = join(targetDirectory, PACKAGE_JSON);

    if (!fileExists(packageJsonFile)) {
        throw new Error(`${packageJsonFile} does not exist`);
    }

    const packageJson = require(packageJsonFile);
    const original = packageJson;

    const dependencyKeys = [
        'dependencies',
        'peerDependencies',
        'devDependencies',
        'bundledDependencies',
        'optionalDependencies',
    ];

    await Promise.all(
        dependencyKeys
            .filter((key) => packageJson[key])
            .map((key) =>
                processDependencyBlock(key, packageJson, exact, debug)
            )
    );

    const hasChanges = original === packageJson;

    if (!hasChanges) {
        console.log('No changes.');
        process.exit(0);
    }

    const formattedFile = JSON.stringify(packageJson, null, 2);

    if (!write) {
        console.log(formattedFile);
        return;
    }

    await fs.writeFile(packageJsonFile, formattedFile);

    console.log(`${packageJsonFile} updated.`);
    process.exit(0);
};

export default PinLatest;
