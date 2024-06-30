import type { ValidationChecks } from 'langium';
import type { LarcAstType } from './generated/ast.js';
import type { LarcServices } from './larc-module.js';

/**
 * Register custom validation checks.
 */
export function registerValidationChecks(services: LarcServices) {
    const registry = services.validation.ValidationRegistry;
    const validator = services.validation.LarcValidator;
    const checks: ValidationChecks<LarcAstType> = {
        // Person: validator.checkPersonStartsWithCapital
    };
    registry.register(checks, validator);
}

/**
 * Implementation of custom validations.
 */
export class LarcValidator {

    // checkPersonStartsWithCapital(person: Person, accept: ValidationAcceptor): void {
    //     if (person.name) {
    //         const firstChar = person.name.substring(0, 1);
    //         if (firstChar.toUpperCase() !== firstChar) {
    //             accept('warning', 'Person name should start with a capital.', { node: person, property: 'name' });
    //         }
    //     }
    // }

}
