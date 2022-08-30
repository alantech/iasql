function isStringArray(obj: unknown): boolean {
    return Array.isArray(obj) && obj.every(it => typeof it === 'string');
}

function isString(obj: unknown): boolean {
    return typeof obj === 'string';
}

function isObject(obj: unknown): boolean {
    return typeof obj === 'object';
}

function objectCompare(obj1: unknown = {}, obj2: unknown = {}): boolean {
    // One is array of a single string and the other is string
    if (isStringArray(obj1) && (obj1 as string[]).length === 1 && isString(obj2)) return (obj1 as string[])[0] === obj2;
    if (isStringArray(obj2) && (obj2 as string[]).length === 1 && isString(obj1)) return (obj2 as string[])[0] === obj1;

    // Both are array of strings
    if (Array.isArray(obj1) && obj1.every(isString) &&
        Array.isArray(obj2) && obj1.every(isString)) {
        if (obj1.length !== obj2.length) return false;
        obj1.sort();
        obj2.sort();
        return obj1.every((element, i) => element === obj2[i]);
    }

    // From https://stackoverflow.com/questions/44792629/how-to-compare-two-objects-with-nested-array-of-object-using-loop
    let same = Object.keys((obj1 as ObjectType)).length === Object.keys((obj2 as ObjectType)).length;
    if (!same) return same;

    for (const key of Object.keys((obj1 as Object))) {
        if (isObject((obj1 as ObjectType)[key as string])) {
            same = objectCompare((obj1 as ObjectType)[key], (obj2 as ObjectType)[key]);
        } else {
            if ((obj1 as ObjectType)[key] !== (obj2 as ObjectType)[key]) {
                same = false;
                break;
            }
        }
    }
    return same;
}

// Returns true if the policies are structurally equal, and false if they aren't
export default function policiesAreSame(obj1: unknown, obj2: unknown): boolean {
    if (Array.isArray(obj1) && obj1.length === 1) return policiesAreSame(obj1[0], obj2);
    if (Array.isArray(obj2) && obj2.length === 1) return policiesAreSame(obj1, obj2[0]);

    let same = Object.keys((obj1 as ObjectType) || {}).length === Object.keys((obj2 as ObjectType) || {}).length;
    if (!same) return same;

    same = true;
    for (const key of Object.keys((obj1 as ObjectType))) {
        switch (key) {
            // Can be String-only
            case IAM_KEY.Version:
            case IAM_KEY.Effect:
            case IAM_KEY.Sid:
                if ((obj1 as ObjectType)[key] !== (obj2 as ObjectType)[key]) {
                    same = false;
                }
                break;
            // Can be an array of single object or just an object
            case IAM_KEY.Statement:
                same = policiesAreSame((obj1 as ObjectType)[key], (obj2 as ObjectType)[key])
                break;
            // Can be JSON or string
            case IAM_KEY.Principal:
            // Can be string or array of strings
            case IAM_KEY.Action:
            case IAM_KEY.Resource:
            // Can only be JSON
            case IAM_KEY.Condition:
            default:
                if (isString((obj1 as ObjectType)[key]) && isString((obj2 as ObjectType)[key]) && (obj1 as ObjectType)[key] !== (obj2 as ObjectType)[key]) {
                    same = false;
                    break;
                }

                same = objectCompare((obj1 as ObjectType)[key], (obj2 as ObjectType)[key]);
                break;
        }

        // If we've found a difference, stop looping.
        if (!same) break;
    }

    return same;
}
