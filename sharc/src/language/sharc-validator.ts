import type { ValidationChecks } from 'langium';
import type { SharcAstType } from './generated/ast.js';
import type { SharcServices } from './sharc-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: SharcServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.SharcValidator;
    const checks: ValidationChecks<SharcAstType> = {
        // Person: validator.checkPersonStartsWithCapital
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class SharcValidator {

    // checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
    //     if (person.name) {
    //         const firstChar = person.name.substring(0, 1);
    //         if (firstChar.toUpperCase() !== firstChar) {
    //             accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
    //         }
    //     }
    // }

}
