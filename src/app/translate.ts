import { Pipe, PipeTransform } from '@angular/core';

@Pipe({name: 'translate'})
export class TranslatePipe implements PipeTransform {
  transform(value: string): string {

    return translate(value);;
  }
}

export const translationConfig = {activateTranslation : false}
var terms:{[key:string]:string}={};

export function translate(s: string) {
    if (!translationConfig.activateTranslation)
        return s;
    let r = terms[s];
    if (!r){
        r =  s.replace(/תורם אחד/g,"חייל אחד")
        .replace(/תורמים חוזרים/g,'חיילים חוזרים')
        .replace(/תורמים מיוחדים/g,"חיילים מיוחדים")
        .replace(/תורם הכי קרוב/g,'חייל הכי קרוב')
        .replace(/תורם כלשהו/g,'חייל כלשהו')
        .replace(/תורמים/g,"חיילים")
        .replace(/תורם/g,'חייל');
        terms[s]=r;
    }
    return r;
    

}